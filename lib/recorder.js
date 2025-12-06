const artnet = require('artnet-node')
const artnetSrv = artnet.Server
const artnetClient = artnet.Client
const fs = require('node:fs');

/**
 * Note: this does not work properly on any os.
 * It has to bind to the artnet udp port, and if that is done by anything else, then it will fail.
 * Also, it creates a new listener for each concurrent discover call, resulting in only the first one actually working
 * If this discovery wants to be fixed, it needs to coordinate with companion core, to share a single binding to the port.
 */
class ArtnetRecorder {
    constructor(self){
        this.self = self
        this.dmxData = []
        this.Client = new artnetClient("192.168.1.102", 6454, 0); //IP Port Universe
        this.port = 6454
        this.sendDmxRecOneIntervall = undefined
        this.records = new Map()
        this.recordDir = "./dmxData/"
    }

    init(){
		this.self.log('debug', 'main/recorder/init: init called')
        fs.readdir(this.recordDir, function (err, files) {
            if(!err){
                var i = 1
                files.forEach(function(file) {
                    const { birthtime } = fs.statSync(this.recordDir+file) // gives date in Sat Dec 06 2025 22:16:04 GMT+0100 (Central European Standard Time) 
                    var created = new Date(birthtime);
                    created = created.getTime(); // moves date to milliseconds 

                    this.records.set(i, {
                        number: i,
                        name: file,
                        created: created,
                    })
                    i++
                }.bind(this))
                this.self.log('debug', 'main/recorder/init: recordings: ' + JSON.stringify(Array.from(this.records.values())))
                this.self.reloadActions()
            }else{
        		this.self.log('error', 'main/recorder/init: fs readDir error: ' + err)
            }
        }.bind(this))
    }

    listRecordings(){
		return Array.from(this.records.values()).sort((a, b) => a.name.localeCompare(b.name))
    }

    startRecording(univers, isLoop){
		this.self.log('debug', 'main/recorder/startRec: startRecord called')
        this.self.DiscoveryInstance.unsubscribe(this.id)
        this.self.Server.listen(this.port, function(err, msg, peer) {
		    console.log('debug', 'main/recorder/startRec: serverListen called, peer: ' + JSON.stringify(peer))
            console.log('debug', 'main/recorder/startRec: serverListen called, msg: ' + JSON.stringify(msg))

            if(!err){
                if (msg.type == 'ArtOutput') {
                        console.log('debug', 'main/recorder/startRec: serverListen - ArtNet Data')
                        console.log('debug', 'main/recorder/startRec: serverListen - Universe: ' + msg.universe + '; wanted universe: ' + univers)
                    if(msg.universe == univers){
                        console.log('debug', 'main/recorder/startRec: serverListen - universe matched - Pushing Data')
                        this.dmxData.push(msg.data);
                    }
                }else{
                    console.log('debug', 'main/recorder/startRec: serverListen - No ArtDMX Data')
                }
            }else{
                console .log('error', 'main/recorder/startRec: serverListen - Error: ' + err)
            }
        }.bind(this))
    }

    stopRecording(recordNumber){
        this.self.log('debug', 'main/recorder/stopRec: stopRecord called')
        this.self.Server.close()

        var recordedDMX = JSON.stringify(this.dmxData);
        //this.records.push("dmxRecord_" + recordNumber)
		this.records.set(recordNumber, {
			number: recordNumber,
			name: 'dmxRecord_' + recordNumber + '.json',
			created: Date.now(),
		})
    
        this.self.log('debug', 'Recodings: ' + this.records)
        fs.writeFile('./dmxData/dmxRecord_' + this.records.get(recordNumber).number + '.json', recordedDMX + "\r\n", function(err) {
            if (!err) {
                this.self.log('debug', 'main/recorder/stopRec: File Written')
            } else {
                this.self.log('error', 'main/recorder/stopRec: Error on file write: ' + err)
            }
        }.bind(this));

        this.self.DiscoveryInstance.subscribe(this.id)
    }

    playRecord(recordNumber){
        this.self.log('debug', 'main/recorder/playRec: playRecord called')
        this.self.log('debug', 'main/recorder/playRec: rocord Number: ' + this.records.get(recordNumber).name)

        fs.readFile('./dmxData/' + this.records.get(recordNumber).name, 'utf8', function(err, data){
            if(!err){
                var dmxRecordOne = JSON.parse(data)

                let i = 0;
                let loop = 1;
                this.sendDmxRecOneIntervall = setInterval(function () {
                    i += 1;
                    if (i === dmxRecordOne.length && loop == false) {
                        clearInterval(sendDmxRecOneIntervall);
                    } else if (i === dmxRecordOne.length && loop == true) {
                        i = 1;
                    }
                    console.log('debug', 'main/recorder/playRec: sending: ' + dmxRecordOne[i-1])
                    this._sendArtNet(dmxRecordOne[i-1]) // i-1 um nulltes element mit zu nehmen
                }.bind(this), 50);
            }else{
                this.self.log('debug', 'main/recorder/playRec: error on fileread: ' + err)
            }
        }.bind(this));
    }

    stopRecord(){
        this.self.log('debug', 'main/recorder/stopRecord: stopRecord called')

        clearInterval(this.sendDmxRecOneIntervall)
    }

    _sendArtNet(data) {
        // Send 1 packet to each node found, at universe 0
        this.Client.send(data, function(err) {
            if (!err) {
                console.log("Packet sent to " + this._host);
            } else {
                console.log("Error: ", err);
            }
        });
    }

    closeSockets(){
        this.Client.close()
    }

}

//module.exports = new ArtnetDiscovery()

module.exports = {
	ArtnetRecorder,
}