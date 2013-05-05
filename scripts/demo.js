document.getElementById('map').style.height = '300px';

map = new L.Map('map');

map.attributionControl.setPrefix('');
var terrain = 'http://{s}.tiles.mapbox.com/v3/mapmeld.map-ofpv1ci4/{z}/{x}/{y}.png';
var terrainAttrib = 'Map data &copy; 2013 OpenStreetMap contributors, Tiles &copy; 2013 MapBox';
terrainLayer = new L.TileLayer(terrain, {maxZoom: 18, attribution: terrainAttrib});
map.addLayer(terrainLayer);

var currentcity = "";
var geojson = [];
var footprint = null;
map.setView(new L.LatLng(47.605237,-122.325897), 14);

var markers = new L.MarkerClusterGroup({ showCoverageOnHover: false });
map.addLayer(markers);
loadData("seattle");

function loadData(city){
  var wll;
  var ctr;
  var callback;

  document.getElementById("seattle").className = "";
  document.getElementById("chicago").className = "";  
  document.getElementById(city).className = "active";
  
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
        map.attributionControl.setPrefix('<a href="' + s.src.replace('/jsonp/geojsonp','.kml') + '" target="_blank">Google Earth Download</a>');
        document.body.appendChild(s);
      };
      break;
    case "chicago":
      ctr = new L.LatLng(41.892,-87.611);
      callback = function(footprint){
        markers.clearLayers();
        var pts = footprint.getLatLngs().concat();
        for(var p=0;p<pts.length;p++){
          pts[p] = pts[p].lng.toFixed(6) + "," + pts[p].lat.toFixed(6);
        }
        var s = document.createElement("script");
        s.type = "text/javascript";
        s.src = "http://philly-crime-checkout.herokuapp.com/geo?area=[[" + pts.join("],[") + "]]&jsonp=geojsonp";
        map.attributionControl.setPrefix('<a href="' + s.src.replace('&jsonp=geojsonp','.kml') + '" target="_blank">Google Earth Download</a>');
        document.body.appendChild(s);
      };
      break;
    case "macon":
      break;
  }

  map.setView(ctr, 15);

  if(footprint){
    map.removeLayer(footprint);
  }
  markers.clearLayers();

  var wll = [ new L.LatLng(ctr.lat, ctr.lng - 0.0115), new L.LatLng(ctr.lat - 0.0025, ctr.lng - 0.002), new L.LatLng(ctr.lat - 0.0019, ctr.lng + 0.007), new L.LatLng(ctr.lat + 0.0017, ctr.lng - 0.013) ];
  footprint = new L.Polygon( wll, { color: "#5500ff", fillOpacity: 0.2, opacity: 0.4 } );
  footprint.editing.enable();
  footprint.on('edit', function(){
    if(geojson.length){
      for(var g=0;g<geojson.length;g++){
        map.removeLayer( geojson[g] );
      }
      geojson = [ ];
    }
    callback(footprint);
  });
  map.addLayer(footprint);
  callback(footprint);
}

function geojsonp(gj){
  L.geoJson(gj, {
    style: function(feature){
      return { clickable: false, weight: 2, fillOpacity: 0.1 };
    },
    onEachFeature: function(feature, layer){
      if(feature.geometry.type == "Point"){
        markers.addLayer(layer);
      }
      else{
        geojson.push(layer);
        map.addLayer(layer);
      }
    }
  });
}