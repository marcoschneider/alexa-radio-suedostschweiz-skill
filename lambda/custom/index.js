'use strict';

const Alexa = require('ask-sdk');
const constants = require('./constants');
const parseString = require('xml2js').parseString;
const Interceptors = require('./handlers/Interceptors');
const https = require('https');

const util = require('util');

const LaunchRequestHandler = {
  canHandle(handleInput) {
    //console.log("Launch Request: " + util.inspect(handleInput, {showHidden: false, depth: null}));
    return handleInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();

    const speakOutput = requestAttributes.t('WELCOME_MESSAGE', requestAttributes.t('SKILL_NAME'));
    const repromptOutput = requestAttributes.t('WELCOME_REPROMPT');

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
  handle: function (handlerInput) {
    const itemSlot = handlerInput.requestEnvelope.request.intent.slots.podcast_name;

    if (itemSlot) {
      if (itemSlot.resolutions.resolutionsPerAuthority[0].status.code !== 'ER_SUCCESS_NO_MATCH') {
        console.log("Item value: " + util.inspect(itemSlot.resolutions.resolutionsPerAuthority[0].values[0].value.id, {
          showHidden: false,
          depth: null
        }));

        let podcast_id = itemSlot.resolutions.resolutionsPerAuthority[0].values[0].value.id;

        getPodcastEpisodes(podcast_id, handlerInput);

        return controller.playPodcast(handlerInput);
      } else {
        return handlerInput.responseBuilder
            .speak("Ich konnte diesen Podcast nicht finden")
            .getResponse();
      }
    }else{
      return handlerInput.responseBuilder
          .speak("Ich konnte diesen Podcast nicht finden")
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
        .speak('Ich konnte dich leider nicht verstehen.')
        .getResponse();
  },
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
  async playPodcast(handlerInput) {
    const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
    const podcastInfo = persistentAttributes.podcastInfo;

    console.log("Persistence: " + util.inspect(podcastInfo, {
      showHidden: false,
      depth: null
    }));

    const playBehavior = 'REPLACE_ALL';

    if (podcastInfo !== undefined) {
      return handlerInput.responseBuilder
          .speak(`Hier der Podcast ${podcastInfo.podcast_name}, Episode ${podcastInfo.current_episode_number}.`)
          .addAudioPlayerPlayDirective(playBehavior, podcastInfo.podcast_episodes, podcastInfo.podcast_episodes, null, 0)
          .getResponse();
    }else{
      console.log(`Error: ${podcastInfo}`);
      return handlerInput.responseBuilder
          .speak("Ich kann den Podcast nicht abspielen!")
          .getResponse();
    }
  },
  stop(handlerInput) {
    return handlerInput.responseBuilder
        .addAudioPlayerStopDirective()
        .getResponse();
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
    const {
      playbackInfo,
      playbackSetting,
    } = await handlerInput.attributesManager.getPersistentAttributes();

    const nextIndex = (playbackInfo.index + 1) % constants.settings.PODCASTS.length;

    if (nextIndex === 0 && !playbackSetting.loop) {
      return handlerInput.responseBuilder
          .speak('You have reached the end of the playlist')
          .addAudioPlayerStopDirective()
          .getResponse();
    }

    playbackInfo.index = nextIndex;
    playbackInfo.offsetInMilliseconds = 0;
    playbackInfo.playbackIndexChanged = true;

    return this.playPodcast(handlerInput);
  },
  async playPrevious(handlerInput) {
    const {
      playbackInfo,
      playbackSetting,
    } = await handlerInput.attributesManager.getPersistentAttributes();

    let previousIndex = playbackInfo.index - 1;

    if (previousIndex === -1) {
      if (playbackSetting.loop) {
        previousIndex += constants.settings.PODCASTS.length;
      } else {
        return handlerInput.responseBuilder
            .speak('Dies ist die erste Episode.')
            .addAudioPlayerStopDirective()
            .getResponse();
      }
    }

    playbackInfo.index = previousIndex;
    playbackInfo.offsetInMilliseconds = 0;
    playbackInfo.playbackIndexChanged = true;

    return this.playPodcast(handlerInput);
  },
};

const ExitHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);
    const request = handlerInput.requestEnvelope.request;

    console.log("Exit Handler: " + util.inspect(request, {showHidden: false, depth: null}));

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
  },
};

const PausePlaybackHandler = {
  async canHandle(handlerInput) {
    const playbackInfo = await getPlaybackInfo(handlerInput);
    const request = handlerInput.requestEnvelope.request;

    console.log("Request:" + util.inspect(request, {showHidden: false, depth: null}));

    return playbackInfo.inPlaybackSession &&
          request.type === 'IntentRequest' &&
          request.intent.name === 'AMAZON.PauseIntent';
  },
  handle(handlerInput) {
    return controller.pause(handlerInput);
  },
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
  },
};

async function getPlaybackInfo(handlerInput) {
  const attributes = await handlerInput.attributesManager.getPersistentAttributes();
  return attributes.playbackInfo;
}

async function getPodcastInfos(handlerInput) {
  const attributes = await handlerInput.attributesManager.getPersistentAttributes();
  return attributes.podcastInfo;
}

function getToken(handlerInput) {
  // Extracting token received in the request.
  return handlerInput.requestEnvelope.context.AudioPlayer.token;
}

async function getIndex(handlerInput) {
  // Extracting index from the token received in the request.
  const tokenValue = parseInt(handlerInput.requestEnvelope.request.token, 10);
  const attributes = await handlerInput.attributesManager.getPersistentAttributes();

  return attributes.playbackInfo.playOrder.indexOf(tokenValue);
}

function getOffsetInMilliseconds(handlerInput) {
  // Extracting offsetInMilliseconds received in the request.
  return handlerInput.requestEnvelope.context.AudioPlayer.offsetInMilliseconds;
}

function getPodcastEpisodes(index, handlerInput) {
  let podcast_episode_url = "";
  https.get(constants.settings.PODCASTS[index].podcastURL, (resp) => {
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

          const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

          persistentAttributes.podcastInfo = {
            podcast_episodes: podcast_episode_url,
            podcast_name: result.rss.channel[0].title[0],
            max_number_of_podcasts_episodes: number_of_episodes -1,
            current_episode_number: number_of_episodes -1
          };

          console.log("Persistence at http" + util.inspect(persistentAttributes, {
            showHidden: false,
            depth: null
          }));

          handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
          handlerInput.attributesManager.savePersistentAttributes();
        } else {
          const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
          persistentAttributes.podcastInfo = {error: err};

          handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
          handlerInput.attributesManager.savePersistentAttributes();
        }
      });
    });

  }).on("error", (err) => {
    console.log("Error: " + err.message);
  });
}

/*const AudioPlayerEventHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type.startsWith('AudioPlayer.');
  },
  async handle(handlerInput) {
    const {
      requestEnvelope,
      attributesManager,
      responseBuilder
    } = handlerInput;
    const audioPlayerEventName = requestEnvelope.request.type.split('.')[1];
    const {
      playbackSetting,
      playbackInfo
    } = await attributesManager.getPersistentAttributes();

    switch (audioPlayerEventName) {
      case 'PlaybackStarted':
        playbackInfo.token = getToken(handlerInput);
        playbackInfo.index = await getIndex(handlerInput);
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
        playbackInfo.index = await getIndex(handlerInput);
        playbackInfo.offsetInMilliseconds = getOffsetInMilliseconds(handlerInput);
        break;
      case 'PlaybackNearlyFinished':
      {
        if (playbackInfo.nextStreamEnqueued) {
          break;
        }

        const enqueueIndex = (playbackInfo.index + 1) % constants.audioData.length;

        if (enqueueIndex === 0 && !playbackSetting.loop) {
          break;
        }

        playbackInfo.nextStreamEnqueued = true;

        const enqueueToken = playbackInfo.playOrder[enqueueIndex];
        const playBehavior = 'ENQUEUE';
        const podcast = constants.audioData[playbackInfo.playOrder[enqueueIndex]];
        const expectedPreviousToken = playbackInfo.token;
        const offsetInMilliseconds = 0;

        responseBuilder.addAudioPlayerPlayDirective(
            playBehavior,
            podcast.url,
            enqueueToken,
            offsetInMilliseconds,
            expectedPreviousToken,
        );
        break;
      }
      case 'PlaybackFailed':
        playbackInfo.inPlaybackSession = false;
        console.log('Playback Failed : %j', handlerInput.requestEnvelope.request.error);
        return;
      default:
        throw new Error('Should never reach here!');
    }

    return responseBuilder.getResponse();
  },
};*/

/* LAMBDA SETUP */
exports.handler = skillBuilder
  .addRequestHandlers(
      CheckAudioInterfaceHandler,
      PausePlaybackHandler,
      StartPlaybackHandler,
      LaunchRequestHandler,
      SessionEndedRequestHandler,
      PlayRadioHandler,
      PlayPodcastWithNameHandler,
      ListAllPodcastsIntent,
      ExitHandler
  )
  .addRequestInterceptors(Interceptors.LocalizationInterceptor)
  .addRequestInterceptors(Interceptors.LoadPersistentAttributesRequestInterceptor)
  .addResponseInterceptors(Interceptors.SavePersistentAttributesResponseInterceptor)
  .addErrorHandlers(ErrorHandler)
  .withAutoCreateTable(true)
  .withTableName(constants.settings.dynamoDBTableName)
  .lambda();