const settings = {
  PODCASTS: [
    {
      title: "Podcast von Radio Südostschweiz.",
      subtitle: "Alexa podcast streaming skill for Radio Südostschweiz",
      name: "R S O im Gespräch",
      podcastURL: "https://www.suedostschweiz.ch/podcasts/feed/1897039",
    },
    {
      title: "Podcast von Radio Südostschweiz.",
      subtitle: "Alexa podcast streaming skill for Radio Südostschweiz",
      name: "R S O in 100 Sekunden",
      podcastURL: "https://www.suedostschweiz.ch/podcasts/feed/2393476",
    }
  ],
  RADIO: {
    title: 'Radio Südostschweiz Livestream',
    subtitle: 'Alexa audio streaming skill for Radio Südostschweiz.',
    cardContent: "Radio Südostschweiz Alexa Skill",
    url: 'https://lsv.swisstxt.ch/rso/livecam_transcode/playlist.m3u8',
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
      WELCOME_MESSAGE: 'Willkommen bei %s. Mit, spiele Radio, kannst du den Livestream des Radios abspielen. Um die Podcasts aufzulisten, sag: "Liste mir alle Podcasts auf". Mit "Spiele den Podcast, dann den Podcastnamen und zum Schluss noch, von Radio Südostschweiz", startest du den Podcast mit der aktuellsten Episode. Was möchtest du nun tun?',
      WELCOME_REPROMPT: 'Mit Alexa spiele Radio gelangst du zum Live Radio. Und Falls du Hilfe brauchst, sag einfach "hilf mir".',
      STOP_MESSAGE: 'Alles klar, auf wiedersehen',
      RADIO_URL_NOT_FOUND: 'Ich konnte die Radio URL nicht finden.',
      TRY_TO_START_SKILL_FIRST: 'Hmm. Versuche zuerst den Skill zu starten, um die Podcasts abspielen zu können.'
    }
  }
};

module.exports = {
  settings,
  languageStrings,
};
