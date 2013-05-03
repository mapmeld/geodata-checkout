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
  client.query('CREATE TABLE customgeos (geom geometry, updated timestamp)', function(err, result){
    res.write(JSON.stringify(result || err.toString()));
    client.query('CREATE TABLE timepoints (point geometry, starttime timestamp, endtime timestamp)', function(err, result){
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
    latlngs[i] = latlngs[i].join(" ");
  }
  if(latlngs[latlngs.length-1] != latlngs[0]){
    latlngs.push(latlngs[0]);
  }
  var wkt = "POLYGON((" + latlngs.join(", ") + "))";
  var now = (new Date()).toISOString().replace("T", " ");
  now = now.substring(0, now.indexOf("Z"));

  client.query("INSERT INTO customgeos VALUES ('" + wkt + "', '" + now + "')", function(err, result){
    res.json({ id: result.oid });
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
  
  client.query("INSERT INTO timepoints VALUES ('POINT(" + (req.body.lng * 1.0).toFixed(6) + " " + (req.body.lat * 1.0).toFixed(6) + ")', '" + start + "', '" + end + "')", function(err, result){
    res.send(JSON.stringify(err || result));
  });
});
  
var processTimepoints = function(timepoints, req, res){
  if(req.url.indexOf('kml') > -1){
    // time-enabled KML output
    var kmlintro = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://earth.google.com/kml/2.2">\n	<Document>\n		<name>Time-Enabled Code Enforcement KML</name>\n		<description>Rounded locations of code enforcement cases 1997-2012</description>\n		<Style id="dot-icon">\n			<IconStyle>\n					<scale>0.6</scale>\n        <Icon>\n          <href>http://homestatus.herokuapp.com/images/macon-marker-02.png</href>\n        </Icon>\n      </IconStyle>\n    </Style>\n    <Style>\n      <ListStyle>\n        <listItemType>checkHideChildren</listItemType>\n      </ListStyle>\n    </Style>\n';
    var kmlpts = '';
    for(var t=0; t<timepoints.length; t++){
      var latitude = timepoints[t].ll[1];
      var longitude = timepoints[t].ll[0];
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
      timepoints[t] = {
        "geometry": {
          "coordinates": [ timepoints[t].ll[0], timepoints[t].ll[1] ]
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
  if(req.query['customgeo'] && req.query['customgeo'] != ""){
    // do a query to return GeoJSON inside a custom polygon
    customgeo.CustomGeo.findById(req.query['customgeo'], function(err, geo){
      if(err){
        res.send(err);
        return;
      }
      var poly = geo.latlngs;
      for(var pt=0;pt<poly.length;pt++){
        poly[pt] = [ poly[pt].split(",")[1] * 1.0, poly[pt].split(",")[0] * 1.0 ];
      }
      timepoint.TimePoint.find({ ll: { "$within": { "$polygon": poly } } }).limit(10000).exec(function(err, timepoints){
        if(err){
          return res.send(err);
        }
        processTimepoints(timepoints, req, res);
      });
    });
  }
  else{
    // do a query to return GeoJSON timeline near a point
    timepoint.TimePoint.find({ ll: { "$nearSphere": [  req.query["lng"] || -83.645782, req.query['lat'] || 32.837026 ], "$maxDistance": 0.01 } }).limit(10000).exec(function(err, timepoints){
      // convert all timepoints into GeoJSON format
      if(err){
        return res.send(err);
      }
      processTimepoints(timepoints, req, res);
    });
  }
});

// redirect all non-existent URLs to doesnotexist
app.get('*', function onNonexistentURL(req,res) {
  res.render('doesnotexist',404);
});

app.listen(process.env.PORT || 3000);