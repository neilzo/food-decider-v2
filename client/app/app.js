(function(window, document) {
  'use strict';
  var userLat;
  var userLon;
  var offset = 0; //grab more results from yelp, since they limit a response to 20 businesses
  var map;
  var infoWindow;
  var bizData;
  var pos = {};
  var bizLocation;
  var businessMarkers = [];
  var loader = '<div class="loader"><span class="loader-item"></span><span class="loader-item"></span><span class="loader-item"></span></div>';

  //get location on init
  (function() {
    var geoOptions = {
      timeout: 10 * 1000,
      maximumAge: 1000 * 60 * 30 //30 minutes before grabbing new location
    };
    // Try HTML5 geolocation.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        userLat = position.coords.latitude;
        userLon = position.coords.longitude;
        pos.lat = userLat;
        pos.lng = userLon;

        document.getElementById('feelinLucky').removeAttribute('disabled');
        document.getElementById('feelinLucky').innerHTML = 'I want to dine out';
        document.getElementById('feelinDelivery').removeAttribute('disabled');
        document.getElementById('feelinDelivery').innerHTML = 'I want to dine in';
      }, function(err) {
        handleLocationError(err, true, infoWindow, map.getCenter());
      }, geoOptions);
    } else {
      // Browser doesn't support Geolocation
      handleLocationError(err, false, infoWindow, map.getCenter());
    }
  })();

  /* APP INIT */
  window.initMap = function() {
    //cries, TODO: make this not on window
    window.directionsService = new google.maps.DirectionsService;
    window.directionsDisplay = new google.maps.DirectionsRenderer({suppressMarkers: true}); //custom icons

    window.icons = {
      start: {
        url: '../public/hungrygato.png',
        size: new google.maps.Size(30, 30),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(0, 30)
      },
      end: {
        url: '../public/happysammich30x30.png',
        size: new google.maps.Size(30, 30),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(0, 30)
      }
    };

    map = new google.maps.Map(document.getElementById('map'), {
      center: {lat: 40.7127, lng: -73.935242}, //center on NYC
      zoom: 15    
    });

    window.directionsDisplay.setMap(map);

    map.setCenter(pos);
  };

  /* === METHODS === */

  /* MAP METHODS */

  function calculateAndDisplayRoute(directionsService, directionsDisplay) {
    directionsService.route({
      origin: {lat: userLat, lng: userLon},
      destination: {lat: bizLocation.lat, lng: bizLocation.lng},
      travelMode: google.maps.TravelMode.WALKING //TODO MAKE SETTABLE
    }, function(response, status) {
      if (status === google.maps.DirectionsStatus.OK) {
        directionsDisplay.setDirections(response);
        var leg = response.routes[0].legs[0];
        makeMarker(leg.start_location, window.icons.start);
        makeMarker(leg.end_location, window.icons.end);
        setMapOnAll(map);
        document.getElementById('tripDetails').innerHTML = ''; //clear trip details wrap on each selection
        displayTripDetails(leg.distance.text, leg.duration.text);
      } else {
        alrt('Directions request failed due to ' + status);
      }
    });
  }

  function makeMarker(position, icon) {
    var marker = new google.maps.Marker({
      position: position,
      icon: icon
    });
    businessMarkers.push(marker);
  }

  function setMapOnAll(map) {
    for (var i = 0; i < businessMarkers.length; i++) {
      businessMarkers[i].setMap(map);
    }
  }

  function removeMarkers() {
    setMapOnAll(null);
    businessMarkers = [];
  }

  function handleLocationError(err, browserHasGeolocation, infoWindow, pos) {
    if (err.code === 1) {
      document.getElementById('header').innerHTML = '<h1>Sorry, this app requires your location to work.';
    } else {
      infoWindow.setPosition(pos);
      browserHasGeolocation ?
      alrt('Error: The Geolocation service failed.') :
      alrt('Error: Your browser doesn\'t support geolocation.');
    }
  }

  function mapYoDigs(data) {
    var biz = {};
    var pos = {};

    pos.lat = data.location.coordinate.latitude;
    pos.lng = data.location.coordinate.longitude;
    
    biz.pos = pos;
    bizLocation = pos;
    biz.name = data.name;

    calculateAndDisplayRoute(window.directionsService, window.directionsDisplay);
  }

  function displayTripDetails(distance, duration) {
    var tripWrap = document.createElement('div');
    tripWrap.setAttribute('class', 'trip-wrap');

    var tripHeader = document.createElement('h4');
    tripHeader.textContent = 'Trip Details:';

    var tripDistance = document.createElement('span');
    tripDistance.textContent = 'Distance: ' + distance;

    var tripTime = document.createElement('span');
    tripTime.textContent = 'Est. Time: ' + duration;

    tripWrap.appendChild(tripHeader);
    tripWrap.appendChild(tripDistance);
    tripWrap.appendChild(tripTime);

    document.getElementById('tripDetails').appendChild(tripWrap);
  }

  /* FOOD DECIDER METHODS */

  //the kick off, calls ajax for local results, transitions between state 1 & 2
  function findFoodLucky() {
    var url;

    //just to be safe
    if (!userLat && !userLon) {
      alrt('Coordinates not ready. Try again.');
      return;
    }

    url = '/api/lucky?lat=' + userLat + '&lon=' + userLon;

    document.getElementById('header').classList.add('fadeout');
    document.getElementById('main').classList.add('fadein');
    window.mode = 'yelp';
    maiAJAXGet(url);
  }

  function findFoodDelivery() {
    var url = '/api/delivery?lat=' + userLat + '&lon=' + userLon;

    document.getElementById('map').remove();
    document.getElementsByClassName('page-wrap')[0].classList.add('delivery-view');
    document.getElementById('header').classList.add('fadeout');
    document.getElementById('main').classList.add('fadein');
    window.mode = 'delivery';
    maiAJAXGet(url);
  }

  function alrt(errorText) {
    var alertsWrap = document.getElementById('alerts');
    var alert = document.createElement('div');
    var close = document.createElement('span');
    alert.setAttribute('class', 'alert');
    close.setAttribute('class', 'close');
    close.addEventListener('click', closeAlert);

    alert.textContent = errorText;

    close.textContent = 'X';
    alert.appendChild(close);

    alertsWrap.appendChild(alert);
  }

  function closeAlert(e) {
    document.getElementById('alerts').removeChild(e.target.parentNode);
    
    return;
  }

  //this is becoming a beast, TODO: find a better way
  function formatResults(data) {
    var businessWrap,
      businessesReview,
      businessImage,
      businessName,
      businessLink,
      businessReviewCount,
      result = document.getElementById('results'),
      biz = selectBiz(data),
      businessTypes,
      businessCats = getBizCategories(biz),
      businessAddress,
      businessAddressString = getBizAddress(biz);

    businessWrap = document.createElement('div');
    businessWrap.setAttribute('class', 'food-card animate');

    businessImage = document.createElement('img');
    businessImage.setAttribute('class', 'main-img');
    businessImage.setAttribute('src', setYelpImg(biz.image_url, 'ls'));

    businessesReview = document.createElement('img');
    businessesReview.setAttribute('src', biz.rating_img_url);

    businessReviewCount = document.createElement('p');
    businessReviewCount.textContent = 'Review Count: ' + biz.review_count;
    
    businessName = document.createElement('p');
    businessName.setAttribute('class', 'business-name');
    businessName.textContent = biz.name;

    businessLink = document.createElement('a');
    businessLink.textContent = 'View on Yelp';
    businessLink.setAttribute('href', biz.url);
    businessLink.setAttribute('target', '_blank');

    businessTypes = document.createElement('p');
    businessTypes.textContent = 'Categories: ' + businessCats;

    businessAddress = document.createElement('p');
    businessAddress.textContent = 'Address: ' + businessAddressString;

    businessWrap.appendChild(businessImage);
    businessWrap.appendChild(businessName);
    businessWrap.appendChild(businessAddress);
    businessWrap.appendChild(businessTypes);
    businessWrap.appendChild(businessLink);
    businessWrap.appendChild(businessesReview);
    businessWrap.appendChild(businessReviewCount);

    result.innerHTML = ''; //clear result wrap
    result.appendChild(businessWrap); //append business
  }

  function formatDelivery(data) {
    var businessImage,
      businessName,
      businessLink,
      businessTypes,
      businessSpecialties,
      businessMin,
      businessEstimate,
      businessReview,
      businessReviewCount,
      yReviewNum,
      yReview,
      result = document.getElementById('results');
    var businessWrap = document.createElement('div');  
    var biz = selectBiz(data);
    var businessCats = getBizCategories(biz);
    var min = '$' + biz.ordering.minimum;
    var specialties = formatSpecialties(biz);
    var estimate = biz.ordering.availability.delivery_estimate;
    var url = '/api/search?term=' + biz.summary.name + '&lat=' + userLat + '&lon=' + userLon;

    ajaxData(url, function(data) {
      if (data.businesses.length === 1) {
        var biz = data.businesses[0];
        yReview = biz.rating_img_url;
        yReviewNum = biz.review_count;

        businessReview = document.createElement('img');
        businessReview.setAttribute('src', biz.rating_img_url);

        businessReviewCount = document.createElement('p');
        businessReviewCount.textContent = 'Review Count: ' + biz.review_count;

        businessWrap.appendChild(businessReview);
        businessWrap.appendChild(businessReviewCount);
      } else {
        //noop, there is *probably* no corresponding Yelp page
        businessReviewCount = 'There appears to be no corresponding Yelp page for this restaurant :(';
      } 
    });

    businessWrap.setAttribute('class', 'food-card animate');

    businessImage = document.createElement('img');
    businessImage.setAttribute('class', 'main-img main-img-sml');
    businessImage.setAttribute('src', biz.summary.merchant_logo);
    
    businessName = document.createElement('p');
    businessName.setAttribute('class', 'business-name');
    businessName.textContent = biz.summary.name;

    businessLink = document.createElement('a');
    businessLink.textContent = 'View on Delivery.com';
    businessLink.setAttribute('href', biz.summary.url.complete);
    businessLink.setAttribute('target', '_blank');

    businessTypes = document.createElement('p');
    businessTypes.textContent = 'Categories: ' + businessCats;

    businessMin = document.createElement('p');
    businessMin.textContent = 'Delivery Min: ' + min;

    businessSpecialties = document.createElement('p');
    businessSpecialties.textContent = 'Top Dishes: ' + specialties;

    businessEstimate = document.createElement('p');
    businessEstimate.textContent = 'Delivery Est: ' + estimate + 'm';

    businessWrap.appendChild(businessImage);
    businessWrap.appendChild(businessName);
    businessWrap.appendChild(businessTypes);
    businessWrap.appendChild(businessLink);
    businessWrap.appendChild(businessMin);
    businessWrap.appendChild(businessSpecialties);
    businessWrap.appendChild(businessEstimate);

    result.innerHTML = ''; //clear result wrap
    result.appendChild(businessWrap); //append business
  }

  function formatSpecialties(biz) {
    var dishes = [];
    var recItems = biz.summary.recommended_items;
    for (var dish in recItems) {
      dishes.push(recItems[dish].name);
    }
    return dishes.join(', ');
  }

  //if all results have been shown, query to find additional, else format prexisting data
  function reRoll(refresh) {
    var tip = document.getElementById('tip');
    removeMarkers(); //remove existing markers

    if (tip) {
      tip.remove();
    }
    if (refresh === 'refresh') {
      offset += 20; //increase global offset to grab more results
      var url = '/api/lucky?lat=' + userLat + '&lon=' + userLon + '&offset=' + offset;
      maiAJAXGet(url);
    } else {
      if (window.mode === 'yelp') {
        formatResults(bizData);
      } else {
        formatDelivery(bizData);
      }
    }
  }

  //grab a higher quality biz thumbnail
  //examples of type:
  //ms: 100 x 100
  //ls: 250 x 250
  //348s: 348 x 348
  //o: up to 1000 x 1000
  function setYelpImg(url, type) {
    var extension = type + '.jpg';
    var regex = /[^/]*$/;

    return url.replace(regex, extension);
  }

  //test if element has been shown to user
  function allShown(element) {
    return element.shown;
  }

  //selects a random business, from the given response data
  function selectBiz(data) {
    var datum = data.businesses ? data.businesses : data.merchants;
    var random = Math.floor(Math.random() * datum.length);
    var chosenOne;

    //don't show delivery options that aren't open
    if (datum === data.merchants && !datum[random].ordering.is_open) {
      return selectBiz(data);
    }

    //if all shown, query for more, else try to find unshown in current data
    if (datum[random].shown) {
      if (datum.every(allShown)) {
        console.log('SHOWN ALL, REQUESTING MORE!');
        reRoll('refresh');
        return;
      } else {
        console.log('shown, trying again');
        return selectBiz(data); //OH BOY RECURSION
      }
    }

    chosenOne = datum[random];
    //mapYoDigs(chosenOne);
    chosenOne.shown = true; //is this the best way? no, but i'm gonna try it
    return chosenOne;
  }

  //returns a single business' categories and formats it
  function getBizCategories(biz) {
    var catString = '';
    var datum = biz.categories ? biz.categories : biz.summary.cuisines;

    for (var i = 0; i < datum.length; i++) {
      // ._.
      if (datum === biz.categories) {   
        if (datum.length === 1 || i === datum.length - 1) {
          catString += datum[i][0];
        } else {
          catString += datum[i][0] + ', ';
        }
      } else {
        if (datum.length === 1 || i === datum.length - 1) {
          catString += datum[i];
        } else {
          catString += datum[i] + ', ';
        }
      }
    };

    return catString;
  }

  //returns a single business' address and formats it
  function getBizAddress(biz) {
    return biz.location.display_address[0] + ', ' + biz.location.display_address[2];
  }

  //Vanilla js ajax
  function maiAJAXGet(url) {    
    var request = new XMLHttpRequest();
    var data;

    console.log('AJAX REQUEST!');

    request.open('GET', url, true);
    document.getElementById('results').innerHTML = loader;

    request.onload = function() {
      if (request.status >= 200 && request.status < 400) {
        // Success!
        // data = JSON.parse(request.responseText);
        // bizData = data; //store so we can flag which results were already seen, go back, etc.
        // formatResults(bizData);

        data = JSON.parse(request.responseText);
        bizData = data;
        formatDelivery(bizData);
      } else {
        // We reached our target server, but it returned an error
        alrt('There was an internal server error, try again later.');
        console.debug(request.responseText);
      }
    };

    request.onerror = function() {
      // There was a connection error of some sort
      alrt('Error sending your request');
    };

    request.send();
  }

  //ajax that returns the data async via callback
  function ajaxData(url, handleData) {    
    var request = new XMLHttpRequest();

    console.log('AJAX REQUEST!');

    request.open('GET', url, true);
    document.getElementById('results').innerHTML = loader;

    request.onload = function() {
      if (request.status >= 200 && request.status < 400) {
        // Success!
        // data = JSON.parse(request.responseText);
        // bizData = data; //store so we can flag which results were already seen, go back, etc.
        // formatResults(bizData);

        handleData(JSON.parse(request.responseText));
      } else {
        // We reached our target server, but it returned an error
        alrt('There was an internal server error, try again later.');
        console.debug(request.responseText);
      }
    };

    request.onerror = function() {
      // There was a connection error of some sort
      alrt('Error sending your request');
    };

    request.send();
  }

  /* === END METHODS === */

  /* EVENT LISTENERS */
  document.getElementById('feelinLucky').addEventListener('click', findFoodLucky);
  document.getElementById('feelinDelivery').addEventListener('click', findFoodDelivery);
  document.getElementById('again').addEventListener('click', reRoll);
})(window, document);
