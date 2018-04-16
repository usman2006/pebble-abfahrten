

if (navigator.language.match(/^de/)) {
  var lang = "DE";
} else {
  var lang = "EN";
}
var isDe = lang == "DE";

// String which is shown in front of the name of a favorite station
var FAV_SYMBOL = "* ";

var Timeline = require('timeline');
var UI = require('ui');
var ajax = require('ajax');
// Used for saving stations as favorites
var Settings = require('settings');

function geoToMVV(lat, lon, callback) {
  //Uncomment these two lines for testing only
 // lat = 48.785674;
 // lon = 9.256159;
  ajax({
    url: "http://192.168.178.45:8080/simpleefa/coordinate?lat="+lat+"&lng="+lon+"&radius=1000&format=JSON",
    type: 'json' 
  }, function(data) {
    var coordinations = [0,0];
    if(data.for_input) {
      var mvv = {
      x : coordinations[0] = data.for_input.lat ,
      y : coordinations[1] = data.for_input.lng
    };
    callback (mvv);
    }
    
  });
}



function disFromTo(lat1, lon1, lat2, lon2) {
  var radlat1 = Math.PI * lat1/180;
	var radlat2 = Math.PI * lat2/180;
	var theta = lon1-lon2;
	var radtheta = Math.PI * theta/180;
	var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
	dist = Math.acos(dist);
	dist = dist * 180/Math.PI;
	dist = dist * 60 * 1.1515;
	dist = dist * 1.609344 ;
  dist =  Math.round(dist * 1000) / 1000;
  
	
	return dist;
}



function getFavs() {
  // get saved favorites
  var favs = Settings.option("favorites");
  // if there are saved favorites, parse them into an array
  // otherwise return an empty array
  return favs ? JSON.parse(favs) : [];
}

function setFavs(favs) {
  // save new favorites
  Settings.option("favorites", JSON.stringify(favs));
}

function saveAsFav(stopID, stopName) {
  // add a stop to favorites
  var favs = getFavs();
  favs.push([stopID, stopName]);
  setFavs(favs);
}

function removeFromFavs(stopID) {
  // remove a stop from favorites
  var favs = getFavs();
  for (var i = 0; i < favs.length; i++) {
    if (favs[i][0] == stopID) {
      // when the stop with the correct ID is found, remove it
      favs.splice(i, 1);
      // and save the modified list of favorite stops
      setFavs(favs);
      return;
    }
  }
}

function isFav(stopID) {
  // returns true iff a stop with the given ID is saved as a favorite
  var favs = getFavs();
  for (var i = 0; i < favs.length; i++) {
    if (favs[i][0] == stopID) {
      return true;
    }
  }
  return false;
}

function formatTitleWithStar(stopID, stopName) {
  // if the given stop is a favorite, return its name asterisked (i.e. with a star: * )
  // otherwise remove the asterisk from the name
  if (isFav(stopID)) {
    if (stopName.lastIndexOf(FAV_SYMBOL, 0) === 0) {
      return stopName;
    } else {
      return FAV_SYMBOL + stopName;
    }
  } else {
    if (stopName.lastIndexOf(FAV_SYMBOL, 0) === 0) {
      return stopName.substring(FAV_SYMBOL.length, stopName.length);
    } else {
      return stopName;
    }
  }
}

function setReminder(title, date)
{
  Timeline.createNotification({
    id: title+date.toISOString(),
    time: date.toISOString(),
    layout: {
      type: "genericPin",
      title: title,
      tinyIcon: "system://images/NOTIFICATION_FLAG"
    }
  });
}

function getFavItems() {
  // return an array of favorite stops
  // each element of the array has a title and a stationID
  var favs = getFavs();
  var items = [];
  for (var i = 0; i < favs.length; i++) {
    var item = {title: favs[i][1],
                stationId: favs[i][0]};
    items.push(item);
  }
  return items;
}


var updater = 0;
var currentStation = 0;


var mainMenu = new UI.Menu({
  sections: [{
    title: isDe?"Haltestellen":"Saved stops",
    items: []
  }, {
    title: isDe?"In der Nähe":"Nearby stops",
    items: []
  }]
});

var departures = new UI.Menu({
  sections: []
});


var start = function() {
  mainMenu.show();
  mainMenu.item(1, 0, {title: isDe?"Suche Position ...":"Fetching location ...",
                       stationID: "INVALID"});
  navigator.geolocation.getCurrentPosition(function(position) {
    geoToMVV(position.coords.latitude , position.coords.longitude, function(mvv){
      //console.debug(mvv.x+":"+mvv.y);
     // mvv.x = 48.785674;
     // mvv.y = 9.256159;
      ajax({
        url: "http://192.168.178.45:8080/simpleefa/coordinate?lat="+mvv.x+"&lng="+mvv.y+"&radius=1000&format=JSON",
        type: 'json' 
      }, function(data) {
        var station = [];
        for (var i in data.station) {
          
            var stopID = data.station[i].id;
            var stopTitle = formatTitleWithStar(stopID, data.station[i].station_name);
            var distance = disFromTo(position.coords.latitude, position.coords.longitude, data.station[i].position.lat, data.station[i].position.lng);
            station.push({
              //title: utf8_decode(stopTitle),
              title: stopTitle,
              subtitle: distance + " km "+(isDe?"entfernt":"away"),
              stationId: stopID
            });
          
        }
        mainMenu.items(1, station);
      });
    });
  });
};



var stationdetails = function(e) {
  // console.log(e.item.stationId);
  
  ajax({
    url: "http://192.168.178.45:8080/simpleefa/nextdepartures?station="+e.item.stationId+"&maxResults=5&format=JSON",
  }, function (data) {
    var body = [];
    
/*      console.log(data.next_departures[2].line.number);
      console.log(data.next_departures[2].to.name);
      console.log(data.next_departures[2].dateandtime.time);*/
    for (var i in data.next_departures) {
      var now = new Date();
      
      
      console.log(data.next_departures[i].line.number);
      console.log(data.next_departures[i].to.name);
      console.log(data.next_departures[i].dateandtime.time);
      console.log(now);
      var then = new Date(""+now.getFullYear()+"-"+(now.getMonth()+1)+"-"+now.getDate()+" "+data.next_departures[i].dateandtime.time);
      console.log(now);
      console.log(then);
      console.log(data.next_departures[i].dateandtime.time+":00");
     if (then - now < 0) {
        continue;
      }
      var diff = Math.max(0, Math.round((then - now) / 1000 / 60) + 1440) % 1440;
/*      var type = "R";
      if (jsonData.next_departures[i].line.match(/^S18/)) {
        type = "S18";
      } else if (jsonData.next_departures[i].line.number ==("S1")) {
        type = "S1";
      } else if (jsonData.next_departures[i].line.number.match(/^S20/)) {
        type = "S20";
      } else if (jsonData.next_departures[i].line.number.match(/^S2/)) {
        type = "S2";
      } else if (jsonData.next_departures[i].line.number.match(/^S3/)) {
        type = "S3";
      } else if (jsonData.next_departures[i].line.number.match(/^S4/)) {
        type = "S4";
      } else if (jsonData.next_departures[i].line.number.match(/^S5/)) {
        type = "S5";
      } else if (jsonData.next_departures[i].line.number.match(/^S6/)) {
        type = "S6";
      } else if (jsonData.next_departures[i].line.number.match(/^S7/)) {
        type = "S7";
      } else if (jsonData.next_departures[i].line.number.match(/^S8/)) {
        type = "S8";
      } else if (jsonData.next_departures[i].line.number.match(/^S/)) {
        type = "S";
      } else if (jsonData.next_departures[i].line.number.match(/^U1/)) {
        type = "U1";
      } else if (jsonData.next_departures[i].line.number.match(/^U2/)) {
        type = "U2";
      } else if (jsonData.next_departures[i].line.number.match(/^U3/)) {
        type = "U3";
      } else if (jsonData.next_departures[i].line.number ==("U4")) {
        type = "U4";
      } else if (jsonData.next_departures[i].line.number.match(/^U5/)) {
        type = "U5";
      } else if (jsonData.next_departures[i].line.number.match(/^U6/)) {
        type = "U6";
      } else if (jsonData.next_departures[i].line.number.match(/^U7/)) {
        type = "U7";
      } else if (jsonData.next_departures[i].line.number.match(/^U8/)) {
        type = "U8";
      } else if(jsonData.next_departures[i].line.number.match(/^U/i)) {
        type = "U";
      } else if(jsonData.next_departures[i].line.number.match(/^N/i)) {
        type = "N";
      } else if(jsonData.next_departures[i].line.number.match(/^X/i)) {
        type = "X";
//      } else if(parseInt(jsonData[i].linie) >= 40) {
//        type = "B";
//      } else if(parseInt(jsonData[i].linie) > 0) {
//        type = "T";
//      } else if(jsonData[i].finalStop.match(/Bayrischzell|Lenggries|Tegernsee|Schliersee|Bad Tölz/)) {
//        type = "BOB";
//      } else if(jsonData[i].finalStop.match(/Deisenhofen|Holzkirchen|Rosenheim|Salzburg|Kufstein/)) {
//        type = "MER";
//      } else if(jsonData[i].finalStop.match(/Kempten|Hof Hbf|^Prag|^Praha/i)) {
//        type = "ALX";
      }*/
      body.push({
        title: data.next_departures[i].line.number
             ? data.next_departures[i].to.name
             : data.next_departures[i].line.number + " " + data.next_departures[i].to.name,
        subtitle: i + data.next_departures[i].datentime.time + " (in " +diff+ (isDe?" Minuten)":" minutes)"),
        time: then,
        
      });
    }
    
    
    
    
    departures.section(0, {
      title: e.item.title,
      items: body
    });
    updater = setTimeout(function(){
      if(e.item.stationId == currentStation) {
        stationdetails(e);
      }
    }, 200000);
  });
};


mainMenu.on('longSelect', function(e) {
  var stationName = e.item.title;
  var stationID = e.item.stationId;
  if (stationID == "INVALID") {
    return;
  }
  if (isFav(stationID)) {
    removeFromFavs(stationID);
  } else {
    saveAsFav(stationID, stationName);
  }
  e.item.title = formatTitleWithStar(stationID, stationName);
});

mainMenu.on("select", function(e) {
  if (e.item.stationId == "INVALID") {
    return;
  }
  departures.section(0, {
    title: e.item.title,
    items: [{
      title: isDe?"Lade Abfahrtszeiten...":"Fetching data..."
    }]
  });
  stationdetails(e);
  departures.show();
});

mainMenu.on("show", function(){
  mainMenu.items(0, getFavItems());
});

departures.on("click", "back", function(){
  departures.hide();
});

/*departures.on("longSelect", function(e){
  var time = e.item.time;
  var date = new Date(time);
  setReminder("Abfahrt "+e.section.title, date);
});*/

start();
