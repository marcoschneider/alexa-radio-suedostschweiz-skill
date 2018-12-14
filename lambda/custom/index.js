'use strict';

const Alexa = require('alexa-sdk');
const parseString = require('xml2js').parseString;
const https = require('https');

// For development.
const util = require('util');

// Radio Stream information.
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

// Podcast object. Needs to be updated when new Podcast is launched.
let podcasts = {
  "0": {
    "title": "Podcast von Radio Südostschweiz.",
    "subtitle": "Alexa podcast streaming skill for Radio Südostschweiz",
    "name": "R S O im Gespräch",
    "podcastURL": "https://www.suedostschweiz.ch/podcasts/feed/1897039",
    "id": "0"
  },
  "1": {
    "title": "Podcast von Radio Südostschweiz.",
    "subtitle": "Alexa podcast streaming skill for Radio Südostschweiz",
    "name": "100 Sekunden",
    "podcastURL": "https://www.suedostschweiz.ch/podcasts/feed/1897039",
    "id": "1"
  }
};

// Mocking database but just at runtime.
let currently_playing = {
  "podcast_episode": null,
  "intent": "PlayPodcastIntent",
  "slot_id": "",
  "podcast_url": "",
  "max_number_of_podcasts": null
};

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
          let number_of_episodes = result.rss.channel[0]["item"].length;
          for (let i = 0; i < number_of_episodes; i++ ) {
            podcast_episode_url = result.rss.channel[0]["item"][i]["enclosure"][0]["$"]["url"];
            podcast_episode_urls.push(podcast_episode_url);
          }
          podcast_episode_urls.reverse();
          if (currently_playing.podcast_episode === null) {
            currently_playing.podcast_episode = number_of_episodes-1;
          }
          currently_playing.max_number_of_podcasts = number_of_episodes-1;
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

function buildPodcastListSpeech() {
  let count = Object.keys(podcasts).length;
  let speechoutput = 'Hier die Liste der Podcasts: ';

  for (let i = 0; i < count; i++) {
    speechoutput += podcasts[""+ i +""].name + ', ';
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
    this.emit(':ask', 'Willkommen bei Radio Südostschweiz. Mit Alexa starte Radio gelangst du zum Livestream. ' +
        'Um die Podcasts zu hören, sag: "liste mir alle Podcasts auf". ' +
        'Was möchtest du tun?',
        'Mit Alexa starte Radio gelangst du zum Live Radio.');
  },
  'PlayRadioIntent': function() {

    // Start radio livestream immediately.
    this.response.speak('Viel Spass mit dem Radio von Radio Südostschweiz.').audioPlayerPlay('REPLACE_ALL', radioStreamInfo.url, radioStreamInfo.url, null, 0);
    this.emit(':responseReady');
  },
  'PlayPodcastIntent':function() {
    let that = this;
    getPodcastEpisodes("0", function (err, podcast_episode_urls) {
      if (err === null ) {

        // Re-assign variables for better readability.
        let podcast = podcasts[0];
        let podcast_episode = podcast_episode_urls[currently_playing.podcast_episode];

        // Speaking the current podcast name and episode number.
        that.response.speak('Hier der standard Podcast ' + podcast.name + ' Episode' + currently_playing.podcast_episode).audioPlayerPlay('REPLACE_ALL', podcast_episode, podcast.machine_name+'_'+podcast.id, null, 0);
        console.log("Current PlayPodcastIntent: " + currently_playing.podcast_episode);
        that.emit(':responseReady');

      } else {

        that.response.speak('Es ist ein Fehler mit dem aufrufen des Podcasts aufgetreten.');
        that.emit(':responseReady');
        console.log("Error: " + err);

      }
    });

  },
  'PlayPodcastWithNameIntent': function(){
    // setting this to that so i can use this in callback function.
    let that = this;

    // Checking if slot id in runtime object is already set.
    if (currently_playing.slot_id === "") {
      let slot_resolutions = this.event.request.intent.slots.podcast_name.resolutions;
      if (slot_resolutions !== undefined) {
        let slot_value_id = slot_resolutions.resolutionsPerAuthority[0].values[0].value.id;
        if (slot_value_id !== undefined) {
          getPodcastEpisodes(slot_value_id, function (err, podcast_episode_urls) {
            if (err == null) {

              // Re-assign variables for better readability.
              let podcast = podcasts[slot_value_id];
              let podcast_episode = podcast_episode_urls[currently_playing.podcast_episode];

              // Saving the current intent and slot id at runtime.
              currently_playing.podcast_url = podcast_episode;
              currently_playing.intent = that.event.request.intent.name;
              currently_playing.slot_id = slot_value_id;

              // Speaking the current podcast name and episode number.
              that.response.speak('Hier der Podcast ' + podcast.name + ' Episode' + currently_playing.podcast_episode).audioPlayerPlay('REPLACE_ALL', podcast_episode, podcast_episode, null, 0);
              that.emit(':responseReady');
            } else {

              that.response.speak('Es ist ein Fehler mit dem aufrufen des Podcasts aufgetreten.');
              that.emit(':responseReady');
              console.log("Error: " + err);
            }
          });
        }else{
          this.response.speak("Ich konnte aus dem Podcast keine ID lesen, deshalb habe ich ihn nicht gefunden.");
          this.emit(":responseReady");
        }
      }else{
        this.response.speak("Es tut mir leid, ich habe dich anscheinend nicht ganz verstanden. Beim nächsten Versuch klappt es.");
        this.emit(":responseReady");
      }
    }else{

      // Assign current podcast id to variable
      let slot_value_id = currently_playing.slot_id;
      getPodcastEpisodes(slot_value_id, function (err, podcast_episode_urls) {
        if (err == null) {

          // Re-assign variables for better readability.
          let podcast = podcasts[slot_value_id];
          let podcast_episode = podcast_episode_urls[currently_playing.podcast_episode];

          // Saving the current intent and slot id at runtime.
          currently_playing.intent = that.event.request.intent.name;
          currently_playing.slot_id = slot_value_id;

          // Speaking the current podcast name and episode number.
          that.response.speak('Hier der Podcast ' + podcast.name + ' Episode' + currently_playing.podcast_episode).audioPlayerPlay('REPLACE_ALL', podcast_episode, podcast_episode, null, 0);
          that.emit(':responseReady');
        } else {

          that.response.speak('Es ist ein Fehler mit dem aufrufen des Podcasts aufgetreten.');
          that.emit(':responseReady');
          console.log("Error: " + err);

        }
      });
    }
  },
  'ListAllPodcastsIntent': function(){
    this.emit(':tell', buildPodcastListSpeech());
  },
  'AMAZON.HelpIntent': function() {
    this.emit(':ask', 'Ich helfe gerne. Du kannst mit, "starte Radio" den Livestream von Radio Südostschweiz höhren. Mit, "starte Podcasts von Radio Südostschweiz" wird der Standard Podcast abgespielt. ' +
      'Falls du einen spezifischen Podcast höhren möchtest, sage, "spiele den Podcast, danach den Podcast Namen und zum schluss noch, von Radio Südostschweiz." Um die Liste der Podcasts abzurufen sage, "liste mir alle Podcasts auf.". Was möchtest du nun machen?');
  },
  'SessionEndedRequest': function() {
    console.log("\n---------- ERROR ----------");
    console.log("\n" + JSON.stringify(this.event.request, null, 2));
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

    if (currently_playing.podcast_episode === currently_playing.max_number_of_podcasts) {
      this.response.speak("Dies ist die aktuellste Podcast Episode.");
      this.emit(':responseReady');
    }else{

      // When request comes from PlayPodcastIntent it's redirecting to that intent when action has been taken.
      if (currently_playing.intent === 'PlayPodcastIntent') {
        currently_playing.podcast_episode = currently_playing.podcast_episode+1;
        this.emit('PlayPodcastIntent');
      } else {
        currently_playing.podcast_episode = currently_playing.podcast_episode+1;
        this.emit('PlayPodcastWithNameIntent');
      }
    }
  },
  'AMAZON.PreviousIntent': function() {

    // When request comes from PlayPodcastIntent it's redirecting to that intent when action has been taken.
    if (currently_playing.intent === 'PlayPodcastIntent') {
      currently_playing.podcast_episode = currently_playing.podcast_episode-1;
      this.emit('PlayPodcastIntent');
    } else {
      currently_playing.podcast_episode = currently_playing.podcast_episode-1;
      this.emit('PlayPodcastWithNameIntent');
    }
  },
  'AMAZON.PauseIntent': function() {

    // Stops the livestream or podcast audio.
    this.response.speak('Alles klar. Ich stoppe den Audio Player').audioPlayerStop();
    this.emit(':responseReady');
  },
  'AMAZON.CancelIntent': function() {
    this.emit('AMAZON.StopIntent');
  },
  'AMAZON.StopIntent': function() {

    // Leaves the skill when called.
    this.response.speak('Okay. Ich habe alles gestoppt').audioPlayerStop();
    this.emit(':responseReady');
  },
  'AMAZON.ResumeIntent': function() {

    // Plays back livestream or podcast where it has been paused.
    if (this.event.context.AudioPlayer.offsetInMilliseconds > 0 &&
        this.event.context.AudioPlayer.playerActivity === 'STOPPED') {

      this.response.speak("Fahre fort.").audioPlayerPlay('REPLACE_ALL',
          this.event.context.AudioPlayer.token,
          this.event.context.AudioPlayer.token,
          null,
          this.event.context.AudioPlayer.offsetInMilliseconds);
    }else {
      this.response.speak("Pausiere zuerst, um weiterzuhöhren.");
    }
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
