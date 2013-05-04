document.getElementById('map').style.height = '300px';

map = new L.Map('map');

map.attributionControl.setPrefix('');
var terrain = 'http://{s}.tiles.mapbox.com/v3/mapmeld.map-ofpv1ci4/{z}/{x}/{y}.png';
var terrainAttrib = 'Map data &copy; 2013 OpenStreetMap contributors, Tiles &copy; 2013 MapBox';
terrainLayer = new L.TileLayer(terrain, {maxZoom: 18, attribution: terrainAttrib});
map.addLayer(terrainLayer);

var currentcity = "";
var geojson = null;
map.setView(new L.LatLng(47.605237,-122.325897), 14);

var existingids = [ ];
loadData("seattle");

function loadData(city){
  var wll;
  var ctr;
  var callback;
  
  switch(city){
    case currentcity:
      return;
      break;
    case "seattle":
      ctr = new L.LatLng(47.605,-122.33);
      callback = function(footprint){
        var pts = footprint.getLatLngs().concat();
        for(var p=0;p<pts.length;p++){
          pts[p] = pts[p].lng.toFixed(6) + "," + pts[p].lat.toFixed(6);
        }
        var s = document.createElement("script");
        s.type = "text/javascript";
        s.src = "http://majurojs.org/timeline-at/[[" + pts.join("],[") + "]]/jsonp/geojsonp";
        document.body.appendChild(s);
      };
      break;
    case "chicago":
      break;
    case "macon":
      break;
  }

  map.setView(ctr, 15);

  var wll = [ new L.LatLng(ctr.lat, ctr.lng - 0.0115), new L.LatLng(ctr.lat - 0.0025, ctr.lng + 0.005), new L.LatLng(ctr.lat - 0.0019, ctr.lng + 0.011), new L.LatLng(ctr.lat + 0.0017, ctr.lng - 0.013) ];
  var footprint = new L.Polygon( wll, { color: "#5500ff", fillOpacity: 0.2, opacity: 0.4 } );
  footprint.editing.enable();
  footprint.on('edit', function(){
    if(geojson){
      map.removeLayer(geojson);
      geojson = null;
    }
    callback(footprint);
  });
  map.addLayer(footprint);
  callback(footprint);
}

function geojsonp(gj){
  geojson = L.geoJson(gj, {
    style: function(feature){
      return { clickable: false, weight: 2, fillOpacity: 0.1 };
    }
  }).addTo(map);
}