'use strict';

const Alexa = require('alexa-sdk-core');
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
    "podcastURL": "https://www.suedostschweiz.ch/podcasts/feed/2393476",
    "id": "1"
  }
};

function PlayPodcastWithNameAfterSkip(that) {
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
    }
    else {
      that.response.speak(messages.episodes_not_found);
      that.emit(':responseReady');
      console.log("Error: " + err);
    }
  });
}

function PlayPodcastWithName(that) {
  let slot_resolutions = that.event.request.intent.slots.podcast_name.resolutions;
  console.log("Current: " + util.inspect(currently_playing, {showHidden: false, depth: null}));
  if (slot_resolutions !== undefined) {
      if (slot_resolutions.resolutionsPerAuthority[0].values !== undefined) {
        let slot_value_id = slot_resolutions.resolutionsPerAuthority[0].values[0].value.id;
        if (currently_playing.slot_id !== slot_value_id) {
          currently_playing.podcast_episode = null;
          getPodcastEpisodes(slot_value_id, function (err, podcast_episode_urls) {
            if (err == null) {

              // Re-assign variables for better readability.
              let podcast = podcasts[slot_value_id];
              let podcast_episode = podcast_episode_urls[currently_playing.podcast_episode];

              // Saving the current intent and slot id at runtime.
              currently_playing.slot_id = slot_value_id;
              currently_playing.intent = that.event.request.intent.name;

              // Speaking the current podcast name and episode number.
              that.response.speak('Hier der Podcast ' + podcast.name + ' Episode ' + currently_playing.podcast_episode).audioPlayerPlay('REPLACE_ALL', podcast_episode, podcast_episode, null, 0);
              that.emit(':responseReady');
            }
            else {
              that.response.speak(messages.episodes_not_found);
              that.emit(':responseReady');
              console.log("Error: " + err);
            }
            console.log("Current: " + util.inspect(currently_playing, {
              showHidden: false,
              depth: null
            }));
          });
        }
      }else{
        that.response.speak(messages.podcast_id_not_found);
        that.emit(":responseReady");
      }
  }else{
    that.response.speak(messages.did_not_understand);
    that.emit(":responseReady");
  }
}

// Mocking database but just at runtime.
let currently_playing = {
  "podcast_episode": null,
  "intent": "",
  "slot_id": "",
  "podcast_name": "",
  "max_number_of_podcasts_episodes": null
};

let messages = {
  episodes_not_found: 'Die Episoden konnten von südostschweiz.ch nicht geladen werden. ' +
                      'Informiere den Entwickler über diesen Fehler. ' +
                      'Hier die E-Mailadresse: marco.schneider@somedia.ch',
  podcast_id_not_found: 'Ich konnte aus dem Podcast keine ID lesen, deshalb habe ich ihn nicht gefunden.',
  did_not_understand: 'Es tut mir leid, ich habe dich anscheinend nicht ganz verstanden. Beim nächsten Versuch klappt es.'
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
          currently_playing.max_number_of_podcasts_episodes = number_of_episodes-1;
          currently_playing.podcast_name = result.rss.channel[0].title[0];
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
    if (i === count) {
      speechoutput += podcasts[""+ i +""].name + '.';
    }else{
      speechoutput += podcasts[""+ i +""].name + ', ';
    }
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
    this.response.speak('Viel Spass mit dem Radio von Südostschweiz.').audioPlayerPlay('REPLACE_ALL', radioStreamInfo.url, radioStreamInfo.url, null, 0);
    this.emit(':responseReady');
  },
  'PlayPodcastIntent':function() {
    let that = this;
    getPodcastEpisodes("0", function (err, podcast_episode_urls) {
      if (err === null ) {
        // Re-assign variables for better readability.
        let podcast = podcasts[0];
        let podcast_episode = podcast_episode_urls[currently_playing.podcast_episode];

        currently_playing.intent = that.event.request.intent.name;
        currently_playing.slot_id = "0";

        // Speaking the current podcast name and episode number.
        that.response.speak('Hier der standard Podcast ' + podcast.name + ' Episode' + currently_playing.podcast_episode).audioPlayerPlay('REPLACE_ALL', podcast_episode, podcast.machine_name+'_'+podcast.id, null, 0);
        that.emit(':responseReady');
      } else {
        that.response.speak(messages.episodes_not_found);
        that.emit(':responseReady');
        console.log("Error: " + err);
      }
    });
  },
  'PlayPodcastWithNameIntent': function() {
    // Checking if slot id in runtime object is already set.
    console.log("Intetius: " + currently_playing.intent);
    switch (currently_playing.intent) {
      case 'AMAZON.NextIntent':
        PlayPodcastWithNameAfterSkip(this);
        break;

      case 'AMAZON.PreviousIntent':
        PlayPodcastWithNameAfterSkip(this);
        break;

      default:
        PlayPodcastWithName(this);
        break;
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
    if (currently_playing.podcast_episode === currently_playing.max_number_of_podcasts_episodes) {
      this.response.speak("Dies ist die aktuellste Podcast Episode.");
      this.emit(':responseReady');
    }else{
      console.log("Current Intent Next: " + currently_playing.intent);
      // When request comes from PlayPodcastIntent it's redirecting to that intent when action has been taken.
      if (currently_playing.intent === 'PlayPodcastIntent') {
        currently_playing.podcast_episode = currently_playing.podcast_episode+1;
        this.emit('PlayPodcastIntent');
      } else {
        currently_playing.podcast_episode = currently_playing.podcast_episode+1;
        currently_playing.intent = this.event.request.intent.name;
        this.emit('PlayPodcastWithNameIntent');
      }
    }
  },
  'AMAZON.PreviousIntent': function() {
    if (currently_playing.podcast_episode < 0) {
      this.response.speak("Dies ist die älteste Podcast Episode.");
      this.emit(':responseReady');
    }else{
      // When request comes from PlayPodcastIntent it's redirecting to that intent when action has been taken.
      console.log("Current Intent Previous: " + currently_playing.intent);
      if (currently_playing.intent === 'PlayPodcastIntent') {
        currently_playing.podcast_episode = currently_playing.podcast_episode-1;
        this.emit('PlayPodcastIntent');
      } else {
        currently_playing.podcast_episode = currently_playing.podcast_episode-1;
        currently_playing.intent = this.event.request.intent.name;
        this.emit('PlayPodcastWithNameIntent');
      }
    }
    console.log("Current Intent Previous second: " + currently_playing.intent);
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
