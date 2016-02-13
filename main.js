'use strict'

var _ = require('lodash')
var Promise = require('bluebird')
Promise.longStackTraces()
var config = require('./config')
var rp = require('request-promise')
var crypto = require('crypto')

var bunyan = require('bunyan')
var logging = bunyan.createLogger({name: config.get('app')})

logging.info(config.get('app') + ' v' + config.get('version') + ' (Node ' + process.version + ') started')
logging.info('--token ' + config.get('token'))
logging.info('--mailchimp_api_token ' + config.get('mailchimp_api_token'))

var apitoken = config.get('mailchimp_api_token')
var dc = apitoken.split('-')[1]

var q = function (url) {
  return {
    uri: 'https://foo:' + apitoken + '@' + dc + '.api.mailchimp.com/3.0/' + url,
    json: true
  }
}

function fetchUserInfo (email, listName) {
  return rp(q('lists'))
    .then(function (response) {
      return _.filter(response.lists, function (list) {
        return list.name + ' Recipients' === listName
      })
    })
    .then(function (lists) {
      if (lists.length !== 1) {
        return
      }
      var list = lists[0]
      return rp(q('lists/' + list.id + '/members/' + crypto.createHash('md5').update(email).digest('hex')))
    })
    .catch(function (err) {
      logging.error('Failed fetch user info', {err: err})
    })
}

var Botkit = require('botkit')
var controller = Botkit.slackbot()
var bot = controller.spawn({
  token: config.get('token')
})
bot.startRTM(function (err) {
  if (err) {
    throw new Error('Could not connect to Slack')
  }
})

controller.on('bot_message', function (bot, message) {
  logging.info('message', message)
  var match = message.text.match(/^<mailto:([^@]+@[^\|]+)\|[^@]+@[^>]+> subscribed to <[^\|]+\|([^>]+)>$/)
  if (!match) {
    return
  }
  fetchUserInfo(match[1], match[2])
    .then(function (member) {
      if (!member) {
        logging.error('Failed to fetch member info for', match)
        return
      }
      rp.post({
        uri: 'https://slack.com/api/chat.postMessage',
        qs: {
          token: config.get('token'),
          channel: message.channel,
          username: config.get('app'),
          icon_url: 'https://slack.global.ssl.fastly.net/12b5a/plugins/mailchimp/assets/service_36.png',
          text: 'The new member is <mailto:' + match[1] + '|' + member.merge_fields.NAME + '>'
        }
      })
      .catch(function (err) {
        logging.error('Failed to post message', err)
      })
    })
})
