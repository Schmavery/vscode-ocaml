var cp = require('child_process');
var path = require('path');
var rl = require('readline');

module.exports = (merlinPath) => {
    var merlin = null
    
    let kill = () => {if (merlin != null) merlin.kill()}
    
    let restartMerlinProcess = () => {
        kill();
        merlin = cp.spawn(merlinPath, []);
        merlin.on('exit', function(code) {
        return console.log("Merlin exited with code " + code);
        });
        
        return console.log("Merlin process (" + merlinPath + ") started, pid = " + merlin.pid);
    }
    
    let queryMerlin = query => {
        console.log("Querying merlin...")
        return new Promise((stdin, stdout) => ((resolve, reject) => {
            console.log("In the promise", stdout, "--", merlin.stdout);
            var count, i, j, jsonQuery, len, q, results;

            var reader = rl.createInterface({
                input: merlin.stdout,
                terminal: false
            });
            
            count = 1;
            if (Array.isArray(query)) {
                count = query.length;
            }
            
            reader.on('line', function(line) {
                var kind, payload, ref;
                ref = JSON.parse(line), kind = ref[0], payload = ref[1];
                console.log("RESPONSE: " + line);
                
                if (kind !== "return") {
                    console.error("Merlin returned error response");
                    reject(Error(line));
                }
                count -= 1;
                if (count === 0) {
                    reader.close();
                    return resolve(payload);
                }
            });
            
            if (Array.isArray(query)) {
                results = [];
                for (i = j = 0, len = query.length; j < len; i = ++j) {
                    q = query[i];
                    jsonQuery = JSON.stringify(q);
                    console.log(jsonQuery.substring(0, 300));
                    results.push(merlin.stdin.write(jsonQuery));
                }
                return results;
            } else {
                jsonQuery = JSON.stringify(query);
                console.log(jsonQuery.substring(0, 300));
                return merlin.stdin.write(jsonQuery);
            }
        })(merlin.stdin, merlin.stdout));
    }
    
    let mkQuery = (path, q) => ({
        context: ["auto", path],
        query: q
    });
    
    let txtPos = (line, col) => ({line: line + 1, col: col});
    
    let rxPos = p => [p.line - 1, p.col];
    
    let syncFile = path => 
      [mkQuery(path, ["tell", "start", "at", txtPos(0, 0)]), mkQuery(path, ["tell", "file-eof", path])];
      
    let syncBuffer = (path, text) =>
      [mkQuery(path, ["tell", "start", "at", txtPos(0, 0)]), mkQuery(path, ["tell", "source-eof", text])];
    
    let syncAll = documents => {
        console.log("syncing");
        try {
        var d = documents
            .filter(doc => doc.fileName.indexOf(path.sep) >= 0)
            .map(doc => {
            //var p = path.join(root, doc.fileName);
            return doc.isDirty ? 
                syncBuffer(doc.fileName, doc.getText()) : 
                syncFile(doc.fileName);
        });
        console.log("synced", d);
        return queryMerlin(d);
        } catch (e) {console.log(e)}
    }
    
    let getTypeAt = (filename, pos, documents) =>
        syncAll(documents).then(() =>
            queryMerlin(mkQuery(path.join(filename), 
                ["type", "enclosing", "at", txPos(pos.line, pos.character)]))
            .then((resp) => {
                var jsonResp = JSON.stringify(resp);
                console.log("Resp: " + jsonResp);
                return resp;
            }));
    
    return {
        restartMerlinProcess,
        syncAll,
        getTypeAt,
        kill
    };
}