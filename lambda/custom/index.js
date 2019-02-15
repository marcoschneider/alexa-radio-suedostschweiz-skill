'use strict';

const Alexa = require('ask-sdk');
const constants = require('./constants');
const parseString = require('xml2js').parseString;
const Interceptors = require('./handlers/Interceptors');
const https = require('https');

const LaunchRequestHandler = {
  canHandle(handleInput) {
    return handleInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
    await getPodcastEpisodes(handlerInput);
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    let speakOutput;
    let repromptOutput;
    if (persistentAttributes.accountId === '') {
      speakOutput = requestAttributes.t('WELCOME_MESSAGE', requestAttributes.t('SKILL_NAME'));
      repromptOutput = requestAttributes.t('WELCOME_REPROMPT');
      persistentAttributes.accountId = handlerInput.requestEnvelope.context.System.user.userId;
      handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
    }
    else{
      speakOutput = "Willkommen zurück. Was möchtest du tun?";
      repromptOutput = "Womit kann ich dir behilflich sein.";
    }

    return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(repromptOutput)
        .getResponse();
  }
};

const ListAllPodcastsIntent = {
  canHandle(handleInput) {
    return handleInput.requestEnvelope.request.type === 'IntentRequest'
        && handleInput.requestEnvelope.request.intent.name === 'ListAllPodcastsIntent'
  },
  handle(handlerInput) {
    let podcasts = constants.settings.PODCASTS;
    let speakOutput = "Hier die Liste der Podcasts: ";

    for (let i = 0; i < podcasts.length; i++) {
      if (podcasts.length === 1 || i === podcasts.length -1) {
        speakOutput += podcasts[i].name + '.';
      }
      else {
        speakOutput += podcasts[i].name + ', ';
      }
    }

    return handlerInput.responseBuilder
        .speak(speakOutput)
        .getResponse();
  }
};

const PlayRadioHandler = {
  canHandle(handleInput) {
    return handleInput.requestEnvelope.request.type === 'IntentRequest'
        && handleInput.requestEnvelope.request.intent.name === 'PlayRadioIntent';
  },
  handle: function (handlerInput) {
    return controller.playRadio(handlerInput);
  }
};

const PlayPodcastWithNameHandler = {
  canHandle(handleInput) {
    return handleInput.requestEnvelope.request.type === 'IntentRequest'
        && handleInput.requestEnvelope.request.intent.name === 'PlayPodcastWithNameIntent';
  },
  handle(handlerInput) {
    const itemSlot = handlerInput.requestEnvelope.request.intent.slots.podcast_name;

    if (itemSlot) {
      if (itemSlot.resolutions.resolutionsPerAuthority[0].status.code !== 'ER_SUCCESS_NO_MATCH') {
        let podcast_id = itemSlot.resolutions.resolutionsPerAuthority[0].values[0].value.id;
        return controller.playPodcast(handlerInput, podcast_id);
      } else {
        return handlerInput.responseBuilder
            .speak("Ich konnte diesen Podcast nicht finden")
            .getResponse();
      }
    }else{
      return handlerInput.responseBuilder
          .speak("Ich habe dich anscheinend nicht ganz verstanden.")
          .reprompt("Wiederhole deinen Befehl nochmals.")
          .getResponse();
    }
  }
};

const PlayPodcastByEpisodeHandler = {
  canHandle(handleInput) {
    return handleInput.requestEnvelope.request.type === 'IntentRequest'
        && handleInput.requestEnvelope.request.intent.name === 'PlayPodcastByEpisodeIntent';
  },
  handle(handlerInput) {
    let episode_number = handlerInput.requestEnvelope.request.intent.slots.podcast_episode;
    let podcast_name = handlerInput.requestEnvelope.request.intent.slots.podcast_name;

    if (episode_number !== undefined) {
      if (podcast_name.resolutions.resolutionsPerAuthority[0].status.code !== 'ER_SUCCESS_NO_MATCH') {
        let podcast_id = podcast_name.resolutions.resolutionsPerAuthority[0].values[0].value.id;
        episode_number = episode_number.value;
        return controller.playPodcast(handlerInput, podcast_id, episode_number);
      } else {
        return handlerInput.responseBuilder
            .speak("Ich konnte diesen Podcast nicht finden")
            .getResponse();
      }
    }else{
      return handlerInput.responseBuilder
          .speak("Ich habe dich nicht ganz verstanden.")
          .reprompt("Wiederhole deinen Befehl nochmals.")
          .getResponse();
    }
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    console.log("Inside SessionEndedRequestHandler");
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${JSON.stringify(handlerInput.requestEnvelope)}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`
    -----------------------------
    Error handled: ${error}`);

    return handlerInput.responseBuilder
        .speak('Ich konnte dich leider nicht verstehen. Frage mich nochmals.')
        .reprompt('Wiederhole deinen Befehl nochmals')
        .getResponse();
  },
};

const AudioPlayerHandler = {
  canHandle(handleInput) {
    return handleInput.requestEnvelope.request.type.startsWith('AudioPlayer.');
  },
  async handle(handlerInput) {
    const audioPlayerEventName = handlerInput.requestEnvelope.request.type.split('.')[1];
    const attributes = await handlerInput.attributesManager.getPersistentAttributes();
    const playbackInfo = attributes.playbackInfo;
    switch (audioPlayerEventName) {
      case 'PlaybackStarted':
        playbackInfo.token = getToken(handlerInput);
        playbackInfo.inPlaybackSession = true;
        playbackInfo.hasPreviousPlaybackSession = true;
      break;
      case 'PlaybackFinished':
        playbackInfo.inPlaybackSession = false;
        playbackInfo.hasPreviousPlaybackSession = false;
        playbackInfo.nextStreamEnqueued = false;
      break;
      case 'PlaybackStopped':
        playbackInfo.token = getToken(handlerInput);
        playbackInfo.offsetInMilliseconds = getOffsetInMilliseconds(handlerInput);
      break;
      case 'PlaybackNearlyFinished':
        if (playbackInfo.nextStreamEnqueued) {
          break;
        }

        playbackInfo.nextStreamEnqueued = true;

        const playBehavior = 'ENQUEUE';
        const radio_url = constants.settings.RADIO.url;
        const expectedPreviousToken = playbackInfo.token;
        const offsetInMilliseconds = 0;

        handlerInput.responseBuilder.addAudioPlayerPlayDirective(
            playBehavior,
            radio_url,
            radio_url,
            offsetInMilliseconds,
            expectedPreviousToken,
        );
        break;
      case 'PlaybackFailed':
        playbackInfo.inPlaybackSession = false;
        console.log('Playback Failed : %j', handlerInput.requestEnvelope.request.error);
      break;

    }
    return handlerInput.responseBuilder.getResponse();
  }
};

/* CONSTANTS */
const skillBuilder = Alexa.SkillBuilders.standard();

const controller = {
  playRadio(handlerInput) {
    let speakOutput = "";
    let requestAttributes = handlerInput.attributesManager.getRequestAttributes();

    if (constants.settings.RADIO.url) {
      return handlerInput.responseBuilder
          .speak("Viel Spass mit dem Radio von Südostschweiz.")
          .addAudioPlayerPlayDirective('REPLACE_ALL', constants.settings.RADIO.url, constants.settings.RADIO.url, null, 0)
          .getResponse();
    }
    else {
      speakOutput = requestAttributes.t('RADIO_URL_NOT_FOUND');
      return handlerInput.responseBuilder
          .speak(speakOutput)
          .getResponse();
    }
  },
  async playPodcast(handlerInput, podcast_id, episode_number) {
    const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const podcasts = persistentAttributes.podcasts;
    const playBehavior = 'REPLACE_ALL';

    if (typeof podcasts !== 'undefined' && podcasts.length > 0) {
      let podcast = podcasts[podcast_id];
      if (episode_number !== undefined) {
        podcast.current_episode_number = episode_number;
        if (episode_number > podcast.max_number_of_podcasts_episodes) {
          return handlerInput.responseBuilder
              .speak("Diese Episode existiert nicht.")
              .getResponse();
        }
      }
      persistentAttributes.playbackInfo.podcast_index = podcast_id;
      handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
      return handlerInput.responseBuilder
          .speak(`Hier der Podcast: ${podcast.podcast_name}. Episode ${podcast.current_episode_number}.`)
          .addAudioPlayerPlayDirective(playBehavior, podcast.currentPodcastEpisodes[podcast.current_episode_number], podcast.currentPodcastEpisodes[podcast.current_episode_number], null, 0)
          .getResponse();
    }else{
      console.log(`Error: podcasts are not defined`);
      return handlerInput.responseBuilder
          .speak(requestAttributes.t('TRY_TO_START_SKILL_FIRST'))
          .getResponse();
    }
  },
  pause(handlerInput) {
    return handlerInput.responseBuilder
        .addAudioPlayerStopDirective()
        .getResponse();
  },
  resume(handlerInput) {
    let token = getToken(handlerInput);
    let offset = getOffsetInMilliseconds(handlerInput);

    return handlerInput.responseBuilder
        .speak('Fahre fort.')
        .addAudioPlayerPlayDirective('REPLACE_ALL', token, token, offset)
        .getResponse();
  },
  async playNext(handlerInput) {
    const attributes = await handlerInput.attributesManager.getPersistentAttributes();
    let podcasts = attributes.podcasts;
    let podcast_id = attributes.playbackInfo.podcast_index;
    let podcast = podcasts[podcast_id];

    if (podcast.current_episode_number === podcast.max_number_of_podcasts_episodes) {
      return handlerInput.responseBuilder
          .speak('Dies ist die aktuellste Podcast Episode')
          .getResponse();
    }

    attributes.podcasts[podcast_id].current_episode_number = podcast.current_episode_number + 1;
    attributes.playbackInfo.offsetInMilliseconds = 0;
    attributes.playbackInfo.playbackIndexChanged = true;
    handlerInput.attributesManager.setPersistentAttributes(attributes);
    return this.playPodcast(handlerInput, podcast_id);
  },
  async playPrevious(handlerInput) {
    const attributes = await handlerInput.attributesManager.getPersistentAttributes();
    let podcasts = attributes.podcasts;
    let podcast_id = attributes.playbackInfo.podcast_index;
    let podcast = podcasts[podcast_id];

    if (podcast.current_episode_number === 0) {
      return handlerInput.responseBuilder
          .speak('Dies ist die letzte Podcast Episode')
          .getResponse();
    }
    attributes.podcasts[podcast_id].current_episode_number = podcast.current_episode_number - 1;
    attributes.playbackInfo.offsetInMilliseconds = 0;
    attributes.playbackInfo.playbackIndexChanged = true;
    handlerInput.attributesManager.setPersistentAttributes(attributes);
    return this.playPodcast(handlerInput, podcast_id);
  }
};

const ExitHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);
    const request = handlerInput.requestEnvelope.request;

    if (playbackInfo.inPlaybackSession === undefined &&
        request.type === 'IntentRequest' &&
        (request.intent.name === 'AMAZON.StopIntent' ||
            request.intent.name === 'AMAZON.CancelIntent')) {
    }

    return !playbackInfo.inPlaybackSession &&
        request.type === 'IntentRequest' &&
        (request.intent.name === 'AMAZON.StopIntent' ||
            request.intent.name === 'AMAZON.CancelIntent');
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
        .speak('Auf wiedersehen!')
        .getResponse();
  }
};

const CancelHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.CancelIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
        .speak('Auf wiedersehen!')
        .getResponse();
  }
};

const SystemExceptionHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'System.ExceptionEncountered';
  },
  handle(handlerInput) {
    console.log(`System exception encountered: ${handlerInput.requestEnvelope.request.reason}`);
  },
};

/*Audio Event Handler*/
const CheckAudioInterfaceHandler = {
  canHandle(handlerInput) {
    const audioPlayerInterface = ((((handlerInput.requestEnvelope.context || {}).System || {}).device || {}).supportedInterfaces || {}).AudioPlayer;
    return audioPlayerInterface === undefined
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
        .speak('Sorry, dieser Skill wird nicht auf Ihrem Gerät unterstützt.')
        .withShouldEndSession(true)
        .getResponse();
  }
};

const PausePlaybackHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);
    const request = handlerInput.requestEnvelope.request;

    return playbackInfo.inPlaybackSession &&
          request.type === 'IntentRequest' &&
          request.intent.name === 'AMAZON.PauseIntent';
  },
  handle(handlerInput) {
    return controller.pause(handlerInput);
  }
};

const StartPlaybackHandler = {
  async canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;

    if (request.type === 'PlaybackController.PlayCommandIssued') {
      return true;
    }

    if (request.type === 'IntentRequest') {
      return request.intent.name === 'AMAZON.ResumeIntent';
    }
  },
  handle(handlerInput) {
    return controller.resume(handlerInput);
  }
};

const NextPlaybackHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);
    const request = handlerInput.requestEnvelope.request;

    return playbackInfo.inPlaybackSession &&
        (request.type === 'PlaybackController.NextCommandIssued' ||
            (request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NextIntent'));
  },
  handle(handlerInput) {
    return controller.playNext(handlerInput);
  }
};

const PreviousPlaybackHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);
    const request = handlerInput.requestEnvelope.request;

    return playbackInfo.inPlaybackSession &&
        (request.type === 'PlaybackController.PreviousCommandIssued' ||
            (request.type === 'IntentRequest' && request.intent.name === 'AMAZON.PreviousIntent'));
  },
  handle(handlerInput) {
    return controller.playPrevious(handlerInput);
  },
};

const HelpHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
        handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  async handle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);
    let message;

    if (!playbackInfo.hasPreviousPlaybackSession) {
      message = 'Willkommen bei Radio Südostschweiz. Mit, spiele Radio, startest du den Livestream von Radio Südostschweiz. Um die Podcasts zu hören, sag: spiele den Podcast, danach den Podcast Namen und zum Schluss musst du noch "von Radio Südostschweiz" sagen, damit ich weiss du möchtest die Podcasts von diesem Skill aus höhren. Was möchtest du machen?';
    } else if (!playbackInfo.inPlaybackSession) {
      message = `Du hast den Podcast ${constants.settings.PODCASTS[playbackInfo.index].name} zuletzt gehört. Mit, spiele Radio, startest du den Livestream von Radio Südostschweiz. Um die Podcasts zu hören, sag: spiele den Podcast, danach den Podcast Namen und zum Schluss musst du noch "von Radio Südostschweiz" sagen, damit ich weiss du möchtest die Podcasts von diesem Skill aus höhren. Was möchtest du machen?`;
    } else {
      message = 'Du hörst Radio Südostschweiz. Um die Podcasts zu hören, sag: spiele den Podcast, danach den Podcast Namen und zum Schluss musst du noch "von Radio Südostschweiz" sagen, damit ich weiss du möchtest die Podcasts von diesem Skill aus höhren. Du kannst zu jeder Zeit pausieren, indem du pause sagst. Um Fortzufahren, sag: Weiter machen oder fortfahren. Wenn du weiter sagst, kannst du die nächste Episode hören. Mit, zurück, kannst du die letzte Episode abspielen. Was möchtest du machen?';
    }

    return handlerInput.responseBuilder
        .speak(message)
        .reprompt(message)
        .getResponse();
  },
};


async function getPlaybackInfo(handlerInput) {
  const attributes = await handlerInput.attributesManager.getPersistentAttributes();
  return attributes.playbackInfo;
}

function getToken(handlerInput) {
  // Extracting token received in the request.
  return handlerInput.requestEnvelope.context.AudioPlayer.token;
}

function getOffsetInMilliseconds(handlerInput) {
  // Extracting offsetInMilliseconds received in the request.
  return handlerInput.requestEnvelope.context.AudioPlayer.offsetInMilliseconds;
}

function getPodcastEpisodes(handlerInput) {
  let podcast_episode_url = "";
  for (let i = 0; i < constants.settings.PODCASTS.length; i++) {
    https.get(constants.settings.PODCASTS[i].podcastURL, (resp) => {
      let data = '';

      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk;
      });

      resp.on('end', () => {
        parseString(data, async function (err, result) {
          if (!err) {
            let podcast_episode_urls = [];
            let number_of_episodes = result.rss.channel[0]["item"].length;
            for (let i = 0; i < number_of_episodes; i++ ) {
              podcast_episode_url = result.rss.channel[0]["item"][i]["enclosure"][0]["$"]["url"];
              podcast_episode_urls.push(podcast_episode_url);
            }
            podcast_episode_urls.reverse();

            let current_episode_number;
            const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

            persistentAttributes.podcasts[i] = {
              podcast_name: constants.settings.PODCASTS[i].name,
              max_number_of_podcasts_episodes: number_of_episodes -1,
              current_episode_number: number_of_episodes -1,
              currentPodcastEpisodes: podcast_episode_urls
            };

            handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
            handlerInput.attributesManager.savePersistentAttributes();
          } else {
            const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
            persistentAttributes.podcastInfo = {error: err};

            handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
          }
        });
      });

    }).on("error", (err) => {
      console.log("Error: " + err.message);
    });
  }
}

/* LAMBDA SETUP */
exports.handler = skillBuilder
  .addRequestHandlers(
      AudioPlayerHandler,
      CheckAudioInterfaceHandler,
      PausePlaybackHandler,
      StartPlaybackHandler,
      LaunchRequestHandler,
      SessionEndedRequestHandler,
      PlayRadioHandler,
      NextPlaybackHandler,
      PreviousPlaybackHandler,
      PlayPodcastWithNameHandler,
      PlayPodcastByEpisodeHandler,
      ListAllPodcastsIntent,
      HelpHandler,
      CancelHandler,
      ExitHandler,
      SystemExceptionHandler
  )
  .addRequestInterceptors(Interceptors.LocalizationInterceptor)
  .addRequestInterceptors(Interceptors.LoadPersistentAttributesRequestInterceptor)
  .addResponseInterceptors(Interceptors.SavePersistentAttributesResponseInterceptor)
  .addErrorHandlers(ErrorHandler)
  .withAutoCreateTable(true)
  .withTableName(constants.settings.dynamoDBTableName)
  .lambda();
