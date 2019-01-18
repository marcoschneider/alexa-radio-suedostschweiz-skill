const Alexa = require('ask-sdk');

const settings = {
  PODCASTS: [
    {
      title: "Podcast von Radio Südostschweiz.",
      subtitle: "Alexa podcast streaming skill for Radio Südostschweiz",
      name: "R S O im Gespräch",
      podcastURL: "https://www.suedostschweiz.ch/podcasts/feed/1897039",
      id: "0"
    },
    {
      title: "Podcast von Radio Südostschweiz.",
      subtitle: "Alexa podcast streaming skill for Radio Südostschweiz",
      name: "100 Sekunden",
      podcastURL: "https://www.suedostschweiz.ch/podcasts/feed/2393476",
      id: "1"
    }
  ],
  RADIO: {
    title: 'Radio Südostschweiz Livestream',
    subtitle: 'Alexa audio streaming skill for Radio Südostschweiz.',
    cardContent: "Radio Südostschweiz Alexa Skill",
    url: 'https://swisstxt2-lh.akamaihd.net/i/grischa_1@144003/master.m3u8',
    image: {
      largeImageUrl: 'https://www.suedostschweiz.ch/modules/custom/so_radio/images/microphon_off.png',
      smallImageUrl: 'https://www.suedostschweiz.ch/modules/custom/so_radio/images/microphon_off.png'
    }
  },
  appId: 'amzn1.ask.skill.fed6c5c1-6ebe-42dd-9dfa-0fe1538e9b39',
  dynamoDBTableName: 'audio-player-persist',
};

const languageStrings = {
  de: {
    translation: {
      SKILL_NAME: 'Radio Südostschweiz',
      WELCOME_MESSAGE: 'Willkommen bei %s. Mit Alexa spiele Radio gelangst du zum Livestream. Um die Podcasts zu hören, sag: "liste mir alle Podcasts auf". Was möchtest du tun?',
      WELCOME_REPROMPT: 'Mit Alexa starte Radio gelangst du zum Live Radio. Und Falls du Hilfe brauchst, sag einfach "hilf mir".',
      STOP_MESSAGE: 'Alles klar, auf wiedersehen',
      RADIO_URL_NOT_FOUND: 'Ich konnte die Radio URL nicht finden.'
    }
  }
};

module.exports = {
  settings,
  languageStrings,
};