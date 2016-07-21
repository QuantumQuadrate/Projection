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
    conn.info_socket.send("HELP");

    // ready subscription
    var x=0;
    conn.data_socket = zmq.socket('sub');
    conn.data_socket.on("message", function(){
      var msg = JSON.parse(arguments[1]);
      msg[0] = new Date(msg[0]);
      gdata.push(msg);
      g.updateOptions( {"file": gdata} ); //, "dateWindow": [then, now]} );
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
        title: 'whatever',
        labels: labels,
        ylabel: 'who cares',
        xlabel: 'Time (HH:MM:SS)',
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
});