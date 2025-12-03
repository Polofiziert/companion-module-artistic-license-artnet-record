const artnet = require('artnet-node')
const artnetClient = artnet.Client
const { UpgradeScripts } = require('./upgrade')
const { ArtnetDiscovery } = require('./discovery')
const { Transitions } = require('./transitions')
const { MAX_CHANNEL, TIMER_SLOW_DEFAULT, TIMER_FAST_DEFAULT } = require('./constants')
const { getActionDefinitions } = require('./actions')
const { InstanceBase, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const { getConfigFieldsDefinition } = require('./config')

class ArtnetInstance extends InstanceBase {
	constructor(internal) {
		//this.log('debug', 'main/ArtnetInst/construct: Constructor called')
		super(internal)

		this.data = new Array(MAX_CHANNEL).fill(0)
		this.DiscoveryInstance = new ArtnetDiscovery(this);

	}

	async init(config) {
		this.log('debug', 'main/ArtnetInst/init: init called')
		this.log('debug', 'main/ArtnetInst/init: id: ' + this.id)

		this.config = config
		this.log('debug', 'main/ArtnetInst/init: config: ' + JSON.stringify(config))

		this.setActionDefinitions(getActionDefinitions(this))

		this.DiscoveryInstance.subscribe(this.id)

		await this.configUpdated(config)
	}

	async configUpdated(config) {
		this.log('debug', 'main/ArtnetInst/confUpdated: configUpdated called')
		this.config = config

		if (this.transitions) this.transitions.stopAll()
		this.transitions = new Transitions(this.data, this.config.timer_fast || TIMER_FAST_DEFAULT, this.do_send.bind(this))

		// Close current client
		if (this.client !== undefined) {
			this.client.close()
			delete this.client
		}

		if (this.config.host) {
			this.client = new artnetClient(this.config.host, 6454, this.config.universe || 0)

			this.updateStatus(InstanceStatus.Ok)
		} else {
			this.updateStatus(InstanceStatus.BadConfig, 'Missing host IP Address')
		}

		if (this.slow_send_timer) {
			clearInterval(this.slow_send_timer)
			delete this.slow_send_timer
		}

		this.slow_send_timer = setInterval(() => {
			// Skip the slow poll if a transition is running
			if (!this.transitions.isRunning()) {
				this.do_send()
			}
		}, this.config.timer_slow || TIMER_SLOW_DEFAULT)
	}

	// When module gets deleted
	async destroy() {
		this.log('debug', 'main/ArtnetInst/destroy: destroy called')
		this.DiscoveryInstance.unsubscribe(this.id)

		this.transitions.stopAll()

		if (this.client) {
			this.client.close()
			delete this.client
		}

		if (this.slow_send_timer) {
			clearInterval(this.slow_send_timer)
			delete this.slow_send_timer
		}
	}

	do_send() {
		this.log('debug', 'main/ArtnetInst/do_send: do_send called')
		if (this.client) {
			this.client.send(this.data, function(self, err, res){
				console.log('error', 'main/ArtnetInst/do_send: artNet Client thrown error when sending: ' + err + '; On Result: ' + res + '; On Data: ' + self)
			})
		}
	}

	// Return config fields for web config, gets called by the webInterface
	getConfigFields() {
		this.log('debug', 'main/ArtnetInst/getConfField: getConfigFields called')
		return getConfigFieldsDefinition(this);
	}
}

runEntrypoint(ArtnetInstance, UpgradeScripts)
