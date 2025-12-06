const artnet = require('artnet-node')


/**
 * Note: this does not work properly on any os.
 * It has to bind to the artnet udp port, and if that is done by anything else, then it will fail.
 * Also, it creates a new listener for each concurrent discover call, resulting in only the first one actually working
 * If this discovery wants to be fixed, it needs to coordinate with companion core, to share a single binding to the port.
 */
class ArtnetDiscovery {
	constructor(self) {
		this.self = self
	}

	subscribers = new Set()
	knownHosts = new Map()
	queryTimer = undefined

	subscribe(instanceId) {
		this.self.log('debug', 'main/discovery/sub: subscribe called, id: ' + instanceId)
		const startListening = this.subscribers.size === 0

		this.subscribers.add(instanceId)

		if (startListening) {
			this._startListening()
		}
	}

	unsubscribe(instanceId) {
		this.self.log('debug', 'main/discovery/unsubscribe: unsubscribe called, subs: ' + JSON.stringify(this.subscribers))

		if (this.subscribers.delete(instanceId) && this.subscribers.size === 0) {
			this._stopListening()
		}
	}

	listKnown() {
		//this.log('debug', 'main/discovery/listKnown: listKnown called, knownHosts: ' + this.knownHosts.values())

		return Array.from(this.knownHosts.values()).sort((a, b) => a.name.localeCompare(b.name))
	}

	_startListening() {
		this.self.log('debug', 'main/discovery/_startListening: _startListening called')

		this.knownHosts.clear()

		if (!this.queryTimer) {
			this.queryTimer = setInterval(() => this._doPoll(), 10000)
		}

		this._doPoll()
	}

	_discoveredNode(err, devs) {
		this.self.log('debug', 'main/discovery/_discoveredNode: _discoveredNode called, devs: ' + devs)

		if (!err && devs) {
			if (devs.length > 0) {
				for (const dev of devs) {
					if (dev.address) {
						this.knownHosts.set(dev.address, {
							address: dev.address,
							name: dev.name || dev.address,
							seen: Date.now(),
						})
						this.self.log('debug', 'main/discovery/_discoveredNode: known host: ' + JSON.stringify(this.knownHosts))
						this.self.log('debug', 'main/discovery/_discoveredNode: known host.seen: ' + JSON.stringify(this.knownHosts.seen))
						this.self.log('debug', 'main/discovery/_discoveredNode: dev Address: ' + JSON.stringify(dev.address))
						this.self.log('debug', 'main/discovery/_discoveredNode: dev name: ' + JSON.stringify(dev.name))
						this.self.log('debug', 'main/discovery/_discoveredNode: dev port: ' + JSON.stringify(dev.port))
						this.self.log('debug', 'main/discovery/_discoveredNode: dev shortName: ' + JSON.stringify(dev.shortName))
						this.self.log('debug', 'main/discovery/_discoveredNode: dev JSON: ' + JSON.stringify(dev))



					}
				}
			}
		}else if (err) {
			this.self.log('error', 'main/discovery/_discoveredNode: _discoveredNode called from ./_doPoll has thrown an error: ' + err)
		}
	}

	_stopListening() {
		this.self.log('debug', 'main/discovery/_stopListening: _stopListening called')

		this.knownHosts.clear()
		if (this.queryTimer) {
			clearInterval(this.queryTimer)
			delete this.queryTimer
		}
	}

	_doPoll() {
		this.self.log('debug', 'main/discovery/_doPoll: _doPoll called')

		this.self.Server.discover(this._discoveredNode.bind(this), 100, '255.255.255.255')
		//artnet.Server.discover(this._discoveredNode.bind(this), 100, '2.255.255.255')	

		/*artnet.Server.discover(function(err, data) {
			if (err) {
				this.self.log('debug', 'main/discovery/_doPoll: Discover got error:' + err)
			} else {
				this.self.log('debug', 'main/discovery/_doPoll: Discover got data:' + data)
			}
		});
		*/

		// Forget devices not seen in a while
		for (const [id, entry] in Object.entries(this.knownHosts)) {
			if (Date.now() > entry.seen + 30000) {
				this.self.log('debug', 'main/discovery/_doPoll: foregt device not long seen ifClause')
				this.knownHosts.delete(id)
			}
		}
	}
}

//module.exports = new ArtnetDiscovery()

module.exports = {
	ArtnetDiscovery,
}
