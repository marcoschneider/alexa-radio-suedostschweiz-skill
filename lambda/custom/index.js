'use strict';

const Alexa = require('alexa-sdk');
const parseString = require('xml2js').parseString;
const https = require('https');
const util = require('util');

let radioStreamInfo = {
  title: 'Radio Südostschweiz Livestream',
  subtitle: 'Alexa audio streaming skill for Radio Südostschweiz.',
  cardContent: "Radio Südostschweiz Alexa Skill",
  url: 'https://swisstxt2-lh.akamaihd.net/i/grischa_1@144003/master.m3u8',
  image: {
    largeImageUrl: 'https://www.suedostschweiz.ch/modules/custom/so_radio/images/microphon_off.png',
    smallImageUrl: 'https://www.suedostschweiz.ch/modules/custom/so_radio/images/microphon_off.png'
  }
};

let podcasts = {
  "0": {
    "title": "Podcasts von Radio Südostschweiz.",
    "subtitle": "Alexa podcast streaming skill for Radio Südostschweiz",
    "name": "R S O im Gespräch",
    "podcastURL": "https://www.suedostschweiz.ch/podcasts/feed/1897039",
    "id": "0"
  },
  "1": {
    "title": "Podcasts von Radio Südostschweiz.",
    "subtitle": "Alexa podcast streaming skill for Radio Südostschweiz",
    "name": "100 Sekunden",
    "podcastURL": "https://www.suedostschweiz.ch/podcasts/feed/1897039",
    "id": "1"
  }
};

function delegateSlotCollection() {
  let updatedIntent = this.event.request.intent;
  console.log("Dialog State: " + util.inspect(this.event.request.dialogState, false, null, true));
  if (this.event.request.dialogState === "STARTED") {
    this.emit(':delegate', updatedIntent);
  } else if (this.event.request.dialogState === "IN_PROGRESS") {
    if(this.event.request.intent.slots.podcast_name.value) {
      console.log("Request Intent" + util.inspect(this.event.request.intent, false ,null, true));

      console.log("This Response" + util.inspect(this.response, false, null, true));
      this.emit(':elicitSlot', 'podcast_name', buildSpeech(), "Kannst du das wiederholen, ich habe dich nicht ganz verstanden");
    } else {
      this.emit(':delegate', updatedIntent);
    }
  } else if (this.event.request.dialogState === 'COMPLETED'){
    // we have collected all of our slots!
    // time to return them
    return updatedIntent
  }
  return null;
}

function getPodcastEpisodes(index, callback) {
  let podcast_episode_url;

  https.get(podcasts[index].podcastURL, (resp) => {
    let data = '';

    // A chunk of data has been recieved.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      parseString(data, function (err, result) {
        if (!err) {
          let podcast_episode_urls = [];
          for (let i = 0; i < result.rss.channel[0]["item"].length; i++ ) {
            podcast_episode_url = result.rss.channel[0]["item"][i]["enclosure"][0]["$"]["url"];
            podcast_episode_urls.push(podcast_episode_url);
          }
          //console.log('Podcast Item: ' + util.inspect(podcast_urls, false, null, true));
          callback(null, podcast_episode_urls);
        } else {
          callback(err, null);
        }
      });
    });

  }).on("error", (err) => {
    console.log("Error: " + err.message);
  });
}

function buildSpeech() {
  let count = Object.keys(podcasts).length;
  let speechoutput = 'Hier die Liste der Podcasts: ';
  for (let i = 0; i < count; i++) {
    speechoutput += podcasts[""+ i +""].name + '. ';
  }

  return speechoutput;
}

exports.handler = (event, context, callback) => {
  var alexa = Alexa.handler(event, context, callback);

  alexa.registerHandlers(
    handlers,
    audioEventHandlers
  );

  alexa.execute();
};

let handlers = {
  'LaunchRequest': function() {
    this.emit(':ask', 'Willkommen bei Radio Südostschweiz. Was möchtest du tun?', 'Mit Alexa starte Radio Südostschweiz gelangst du zum Livestream. Um den Podcast zu hören, sage: Alexa liste mir alle Podcasts auf.');
  },
  'PlayRadioIntent': function() {
    this.response.speak('Viel Spass.').audioPlayerPlay('REPLACE_ALL', radioStreamInfo.url, radioStreamInfo.url, null, 0);
    this.emit(':responseReady');
  },
  'PlayPodcastIntent':function() {
    let count = Object.keys(podcasts).length;
    let that = this;
    if (count > 1) {
      console.log(util.inspect(this.attributes.podcast_index, false, null, true));
      let podcast_index = "0";
      if (this.attributes.podcast_index !== undefined) {
        podcast_index = this.attributes.podcast_index;
      }
      getPodcastEpisodes(podcast_index, function (err, podcast_episode_urls) {
        if (err == null) {
          let podcast = podcasts[podcast_index];
          console.log("Podcast Index" + podcast_index);
          that.response.speak('Ich starte nun den Podcast ' + podcast.name).audioPlayerPlay('REPLACE_ALL', podcast_episode_urls[0], podcast_episode_urls[0], null, 0);
          that.attributes.podcasts = {
            'currentPodcastEpisode': 0,
            'currentPodcastName': podcasts.name,
            'currentPodcastId': podcast_index
          };
          that.emit(':responseReady');
        } else {
          that.response.speak('Es ist ein Fehler mit dem aufrufen des Podcasts aufgetreten.');
          that.emit(':responseReady');
          console.log("Error: " + err);
        }
      });
    } else {
      getPodcastEpisodes("0", function (err, podcast_episode_urls) {
        if (err === null ) {
          that.response.speak('Ich starte nun den Podcast ' + podcasts[0].name).audioPlayerPlay('REPLACE_ALL', podcast_episode_urls[0], podcast_episode_urls[0], null, 0);
          that.emit(':responseReady');
        } else {
          that.response.speak('Es ist ein Fehler mit dem aufrufen des Podcasts aufgetreten.');
          that.emit(':responseReady');
          console.log("Error: " + err);
        }
      });
    }
  },
  'PlayPodcastWithNameIntent': function(){

    let slot_resolutions = this.event.request.intent.slots.podcast_name.resolutions;

    if (slot_resolutions !== undefined) {
      console.log("Attributes: " + util.inspect(slot_resolutions, false, null, true));
      let slot_value_id = slot_resolutions.resolutionsPerAuthority[0].values[0].value.id;
      if (slot_value_id !== undefined) {
        this.attributes.podcast_index = slot_value_id;
        this.emit('PlayPodcastIntent');
      }else{
        this.response.speak("Ich habe diesen Podcast leider nicht gefunden");
        this.emit(":responseReady");
      }
    }else{
      this.response.speak("Es tut mir leid, ich konnte diesen Podcast nicht finden");
      this.emit(":responseReady");
    }
  },
  'ListAllPodcastsIntent': function(){
    this.emit(':tell', buildSpeech());
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
    console.log("Attributes: " + util.inspect(this.attributes, false, null, true));
    this.response.speak('Hier die nächste Podcast episode.');
    this.emit(':responseReady');
  },
  'AMAZON.PreviousIntent': function() {
    this.response.speak('Diese Skill unterstüzt das Überspringen von Songs nicht.');
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
