'use strict';

var Alexa = require('alexa-sdk');
var https = require('https');

var radioStreamInfo = {
  title: 'Radio Südostschweiz Livestream',
  subtitle: 'Alexa audio streaming skill for Radio Südostschweiz.',
  cardContent: "Radio Südostschweiz Alexa Skill",
  url: 'https://swisstxt2-lh.akamaihd.net/i/grischa_1@144003/master.m3u8',
  image: {
    largeImageUrl: 'https://www.suedostschweiz.ch/modules/custom/so_radio/images/microphon_off.png',
    smallImageUrl: 'https://www.suedostschweiz.ch/modules/custom/so_radio/images/microphon_off.png'
  }
};

//Standard Podcast

var podcasts = {
  "rso-im-gsproech": {
    title: 'Podcasts von Radio Südostschweiz.',
    subtitle: 'Alexa podcast streaming skill for Radio Südostschweiz',
    name: 'RSO im Gspröch',
    podcastURL: 'https://www.suedostschweiz.ch/podcasts/feed/1897039'
  }
};

exports.handler = (event, context, callback) => {
  var alexa = Alexa.handler(event, context, callback);

  alexa.registerHandlers(
    handlers,
    audioEventHandlers
  );

  alexa.execute();
};

var handlers = {
  'LaunchRequest': function() {
    this.emit('PlayRadioIntent');
  },
  'PlayRadioIntent': function() {
    this.response.speak('Willkommen bei Radio Südostschweiz. Viel Spass').audioPlayerPlay('REPLACE_ALL', radioStreamInfo.url, radioStreamInfo.url, null, 0);
    this.emit(':responseReady');
  },
  'PlayPodcastIntent':function() {
    this.response.speak('Ich starte nun den Podcast' + podcasts["rso-im-gsproech"].name);
    this.emit(':responseReady');
  },
  'SearchPodcastIntent': function(){
    this.response.speak('Um alle Podcasts aufzulisten sage: "Alexa, liste mir alle Podcasts auf."');
    this.emit(':responseReady');
  },
  'AMAZON.HelpIntent': function() {
    // skill help logic goes here
    this.emit(':responseReady');
  },
  'SessionEndedRequest': function() {
    // no session ended logic needed
  },
  'ExceptionEncountered': function() {
    console.log("\n---------- ERROR ----------");
    console.log("\n" + JSON.stringify(this.event.request, null, 2));
    this.callback(null, null)
  },
  'Unhandled': function() {
    this.response.speak('Entschuldigung, etwas ist schief gelaufen.');
    this.emit(':responseReady');
  },
  'AMAZON.NextIntent': function() {
    this.response.speak('This skill does not support skipping.');
    this.emit(':responseReady');
  },
  'AMAZON.PreviousIntent': function() {
    this.response.speak('This skill does not support skipping.');
    this.emit(':responseReady');
  },
  'AMAZON.PauseIntent': function() {
    this.emit('AMAZON.StopIntent');
  },
  'AMAZON.CancelIntent': function() {
    this.emit('AMAZON.StopIntent');
  },
  'AMAZON.StopIntent': function() {
    this.response.speak('Okay. Ich habe alles abgebrochen').audioPlayerStop();
    this.emit(':responseReady');
  },
  'AMAZON.ResumeIntent': function() {
    this.emit('PlayStream');
  },
  'AMAZON.LoopOnIntent': function() {
    this.emit('AMAZON.StartOverIntent');
  },
  'AMAZON.LoopOffIntent': function() {
    this.emit('AMAZON.StartOverIntent');
  },
  'AMAZON.ShuffleOnIntent': function() {
    this.emit('AMAZON.StartOverIntent');
  },
  'AMAZON.ShuffleOffIntent': function() {
    this.emit('AMAZON.StartOverIntent');
  },
  'AMAZON.StartOverIntent': function() {
    this.response.speak('Sorry. Das kann ich momentan nicht machen.');
    this.emit(':responseReady');
  },
  'PlayCommandIssued': function() {

    if (this.event.request.type === 'IntentRequest' || this.event.request.type === 'LaunchRequest') {
      var cardTitle = radioStreamInfo.subtitle;
      var cardContent = radioStreamInfo.cardContent;
      var cardImage = radioStreamInfo.image;
      this.response.cardRenderer(cardTitle, cardContent, cardImage);
    }

    this.response.speak('Ich starte nun den Radio. Viel Spass.').audioPlayerPlay('REPLACE_ALL', radioStreamInfo.url, radioStreamInfo.url, null, 0);
    this.emit(':responseReady');
  },
  'PauseCommandIssued': function() {
    this.emit('AMAZON.StopIntent');
  }
};

var audioEventHandlers = {
  'PlaybackStarted': function() {
    this.emit(':responseReady');
  },
  'PlaybackFinished': function() {
    this.emit(':responseReady');
  },
  'PlaybackStopped': function() {
    this.emit(':responseReady');
  },
  'PlaybackNearlyFinished': function() {
    this.response.audioPlayerPlay('REPLACE_ALL', radioStreamInfo.url, radioStreamInfo.url, null, 0);
    this.emit(':responseReady');
  },
  'PlaybackFailed': function() {
    this.response.audioPlayerClearQueue('CLEAR_ENQUEUED');
    this.emit(':responseReady');
  }
};
