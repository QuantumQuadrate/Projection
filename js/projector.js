$(document).ready(function(){
  var zmq = require('zmq');
  var dyg = require('dygraphs');

  var knownStreamVersions = {};
  var streamID = 1;

  var labels = ["time"];
  var gdata = [];
  var g;
  var now = Date.now();
  var then = now - 1000*60*10;
  var buffer = [];

  // pad with zeros
  function pad(n, width, z){
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  }

  function connectToServer(conn){
    // need to add modules to the path manually
    console.log("Retrieving list of streams.");
    // were going to ask the server for information on this socket
    // for now we can only get the list of available streams
    conn.info_socket = zmq.socket('req');
    conn.info_socket.on("message", function(reply){
      knownStreamVersions = JSON.parse(reply);
      $('#data').text(Object.keys(knownStreamVersions));
      for ( var key in knownStreamVersions ){
        if ( knownStreamVersions[key].id == streamID ){
          labels = labels.concat(knownStreamVersions[key].keyOrder);
        }
      }
      conn.info_socket.close();
    });
    var info_url = 'tcp://' + conn.server.toString() + ':' + conn.info_port.toString();
    console.log('Server at: ', info_url);
    conn.info_socket.connect(info_url);
    conn.info_socket.send("MESSAGE RECIEVED");

    // ready subscription
    var x=0;
    conn.data_socket = zmq.socket('sub');
    conn.data_socket.on("message", function(){
      var msg = JSON.parse(arguments[1]);
      //msg[0] = new Date(msg[0]);
      buffer.push(msg);
    });

    sub_filter = pad(streamID, 4, '0');
    console.log("Subscribing to data server with filter ["+ sub_filter +"]");
    var data_url = 'tcp://' + conn.server.toString() + ':' + conn.data_port.toString();
    console.log('Server at: ', data_url);
    conn.data_socket.connect(data_url);
    conn.data_socket.subscribe(sub_filter);

    process.on('SIGINT', function() {
      console.log('Shutting down connections');
      conn.data_socket.close();
      conn.info_socket.close();
    });
  }

  function waitForResponse(){
    if( labels.length == 1 ){
      setTimeout(function(){
        waitForResponse();
      },250);
    } else {
      console.log("we should be good"); 
      console.log(labels);
      g = new dyg(document.getElementById("div_g"), gdata, {
        rollPeriod: 0, 
        legend: 'always',
        title: 'Title',
        labels: labels,
        ylabel: 'Y axis',
        xlabel: 'Time (HH:MM:SS)',
        errorBars: true,
        strokeWidth: 4,
        highlightCircleSize: 4,
        labelsDivStyles: {
          'text-align': 'right',
          'background': 'none'
        },
        //dateWindow: [then, now],
        strokeWidth: 5,
      });
    }
  }

  var conn = {
    server: 'localhost',
    data_port: 5556,
    info_port: 5557
  };
  connectToServer(conn);
  waitForResponse();

  function updateGraph(){
    if( labels.length > 1 ){
      console.log(buffer.length);
      if( buffer.length > 0 ){
        temp = buffer;
        buffer = [];
        newData = temp[0];

        // average
        for( var i=1; i<temp.length; i++){
          for( var j=1; j<temp[0].length; j++ ){
            newData[j] += temp[i][j];
          }
        }
        for( var j=1; j<temp[0].length; j++ ){
          newData[j] = [newData[j]/temp.length, 0];
        }

        // standard dev
        for( var i=1; i<temp.length; i++){
          for( var j=1; j<temp[0].length; j++ ){
            newData[j][1] += Math.pow(temp[i][j] - newData[j][0], 2)/temp.length;
          }
        }
        for( var j=1; j<temp[0].length; j++ ){
          newData[j][1] = Math.sqrt(newData[j][1]);
        }

        console.log(newData);
        newData[0] = new Date(newData[0]*1000); // javascript is in ms because someone is a dipshit
        console.log(newData);
      }
      gdata.push(newData);
      g.updateOptions( {"file": gdata} ); //, "dateWindow": [then, now]} );
    }
    setTimeout(arguments.callee, 5000);
  }
$(function(){
	function toStream(id){
		displayID = id + 1;
		alert("Starting Stream " + displayID + ".");
    	console.log("Unsubscribing from data socket with filter ["+ sub_filter +"]");
	conn.data_socket.unsubscribe(sub_filter);

//clear variables, set new ID
		//buffer = [];
		labels = ["time"];		
		gdata = [];
		g.updateOptions({'file':gdata,
		'dateWindow':[then,now]} );
		streamID = id;

    sub_filter = pad(streamID, 4, '0');
    console.log("Subscribing to data server with filter ["+ sub_filter +"]");
    var data_url = 'tcp://' + conn.server.toString() + ':' + conn.data_port.toString();
    console.log('Server at: ', data_url);
    conn.data_socket.connect(data_url);
    conn.data_socket.subscribe(sub_filter);
	buffer = [];
	g.destroy();

		connectToServer(conn);
		waitForResponse();
		updateGraph();
}
window.toStream=toStream;
});
  updateGraph();
});
