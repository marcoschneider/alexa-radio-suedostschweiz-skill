module.exports = {
  PODCASTS: {
    "rso im gespraech":{
      "title": "Podcast von Radio Südostschweiz.",
      "subtitle": "Alexa podcast streaming skill for Radio Südostschweiz",
      "name": "R S O im Gespräch",
      "podcastURL": "https://www.suedostschweiz.ch/podcasts/feed/1897039",
      "id": "0"
    },
    "100 sekunden": {
      "title": "Podcast von Radio Südostschweiz.",
      "subtitle": "Alexa podcast streaming skill for Radio Südostschweiz",
      "name": "100 Sekunden",
      "podcastURL": "https://www.suedostschweiz.ch/podcasts/feed/2393476",
      "id": "1"
    }
  },
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