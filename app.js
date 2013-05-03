/*jshint laxcomma:true */

/**
 * Module dependencies.
 */
var express = require('express')
    , pg = require('pg').native
    , routes = require('./routes')
    ;

var app = express.createServer();

var client = new pg.Client(process.env.HEROKU_POSTGRESQL_CYAN_URL || 'postgres://localhost:5432/postgis');
client.connect();

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('view options', { pretty: true });

  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.static(__dirname + '/public'));
  app.use(app.router);

});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: false}));
});
  
// Routes

app.get('/', function(req, res){
  // show timeline editor (not yet designed)
  res.render('checkouttimemaker');
});

app.get('/createtables', function(req, res){
  client.query('CREATE TABLE customgeos (id SERIAL, geom geometry, updated timestamp)', function(err, result){
    res.write(JSON.stringify(result || err.toString()));
    client.query('CREATE TABLE timepoints (id SERIAL, point geometry, starttime timestamp, endtime timestamp)', function(err, result){
      res.write(JSON.stringify(result || err.toString()));
      res.end();
    });
  });
});

app.post('/customgeo', function(req, res){
  var latlngs = req.body.pts.split("|");
  for(var i=0;i<latlngs.length;i++){
    latlngs[i] = latlngs[i].split(",").slice(0,2);
    latlngs[i][0] = (latlngs[i][0] * 1.0).toFixed(6);
    latlngs[i][1] = (latlngs[i][1] * 1.0).toFixed(6);
    latlngs[i] = latlngs[i].reverse().join(" ");
  }
  if(latlngs[latlngs.length-1] != latlngs[0]){
    latlngs.push(latlngs[0]);
  }
  var wkt = "POLYGON((" + latlngs.join(", ") + "))";
  var now = (new Date()).toISOString().replace("T", " ");
  now = now.substring(0, now.indexOf("Z"));

  client.query("INSERT INTO customgeos (geom, updated) VALUES ('" + wkt + "', '" + now + "') RETURNING id", function(err, result){
    //res.send( JSON.stringify(result) || err.toString() );
    res.json({ id: result.rows[0].id });
  });
});

app.get('/timeline', function(req, res){
  // show timeline
  res.render('checkouttime', { customgeo: req.query['customgeo'] });
});

app.post('/timeline', function(req, res){
  // load this point into PostGIS
  var start = req.body.start;
  var end = req.body.end;
  if(!start){
    start = new Date();
  }
  else if(isNaN( start * 1.0 )){
    start = new Date(start);  
  }
  else if(start * 1.0 < 10000){
    start = new Date("January 10, " + start);
  }
  else{
    start = new Date(start * 1.0);
  }
  start = start.toISOString();
  start = start.replace("T", " ").substring(0, start.indexOf("Z"));
  
  if(!end){
    end = new Date();
  }
  else if(isNaN( end * 1.0 )){
    end = new Date(end);  
  }
  else if(end * 1.0 < 10000){
    end = new Date("January 10, " + end);
  }
  else{
    end = new Date(end * 1.0);
  }
  end = end.toISOString();
  end = end.replace("T", " ").substring(0, end.indexOf("Z"));
  
  client.query("INSERT INTO timepoints (point, starttime, endtime) VALUES ('POINT(" + (req.body.lng * 1.0).toFixed(6) + " " + (req.body.lat * 1.0).toFixed(6) + ")', '" + start + "', '" + end + "')", function(err, result){
    res.send(JSON.stringify(err || result));
  });
});
  
var processTimepoints = function(timepoints, req, res){
  if(req.url.indexOf('kml') > -1){
    // time-enabled KML output
    var kmlintro = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://earth.google.com/kml/2.2">\n	<Document>\n		<name>Time-Enabled Code Enforcement KML</name>\n		<description>Rounded locations of code enforcement cases 1997-2012</description>\n		<Style id="dot-icon">\n			<IconStyle>\n					<scale>0.6</scale>\n        <Icon>\n          <href>http://homestatus.herokuapp.com/images/macon-marker-02.png</href>\n        </Icon>\n      </IconStyle>\n    </Style>\n    <Style>\n      <ListStyle>\n        <listItemType>checkHideChildren</listItemType>\n      </ListStyle>\n    </Style>\n';
    var kmlpts = '';
    for(var t=0; t<timepoints.length; t++){
      var pt = JSON.parse(timepoints[t].st_asgeojson);
      var latitude = pt.coordinates[1];
      var longitude = pt.coordinates[0];
      var startstamp = (new Date(timepoints[t].start)).toISOString();
      var endstamp = (new Date(timepoints[t].end)).toISOString();
      kmlpts += '	<Placemark>\n		<TimeSpan>\n';
      kmlpts += '			<begin>' + startstamp + '</begin>\n';
      kmlpts += '			<end>' + endstamp + '</end>\n';
      kmlpts += '		</TimeSpan>\n		<styleUrl>#dot-icon</styleUrl>\n		<Point>\n';
      kmlpts += '			<coordinates>' + longitude + ',' + latitude + '</coordinates>\n';
      kmlpts += '		</Point>\n	</Placemark>\n';
    }
    var kmlout = '  </Document>\n</kml>';
    res.setHeader('Content-Type', 'application/kml');
    res.send(kmlintro + kmlpts + kmlout);
  }
  else{
    // GeoJSON output
    for(var t=0; t<timepoints.length; t++){
      var pt = JSON.parse(timepoints[t].st_asgeojson);
      timepoints[t] = {
        "geometry": {
          "coordinates": pt.coordinates
        },
        "properties": {
          "startyr": timepoints[t].start,
          "endyr": timepoints[t].end
        }
      };
    }
    res.send({ "type":"FeatureCollection", "features": timepoints });
  }
};
  
app.get('/timeline-at*', function(req, res){
    // do a query to return GeoJSON inside a custom polygon
      
    client.query("SELECT starttime, endtime, ST_AsGeoJson(point) FROM customgeos, timepoints WHERE customgeos.id = " + (1 * req.query.customgeo) + " AND ST_Contains(customgeos.geom, timepoints.point)", function(err, timepoints){
      if(err){
        return res.send(err);
      }
      processTimepoints(timepoints.rows, req, res);
    });
});

// redirect all non-existent URLs to doesnotexist
app.get('*', function onNonexistentURL(req,res) {
  res.render('doesnotexist',404);
});

app.listen(process.env.PORT || 3000);