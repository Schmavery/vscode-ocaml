var cp = require('child_process');
var path = require('path');

module.exports = (merlinPath) => {
    var merlin = null
    
    let restartMerlinProcess = () => {
        if (merlin != null) {
            merlin.kill();
        }
        merlin = cp.spawn(merlinPath, []);
        merlin.on('exit', function(code) {
        return console.log("Merlin exited with code " + code);
        });
        
        return console.log("Merlin process (" + merlinPath + ") started, pid = " + merlin.pid);
    }
    
    let queryMerlin = query => 
        new Promise((stdin, stdout) => ((resolve, reject) => {
            var count, i, j, jsonQuery, len, q, reader, results;
            
            reader = createInterface({
                input: stdout,
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
                    results.push(stdin.write(jsonQuery));
                }
                return results;
            } else {
                jsonQuery = JSON.stringify(query);
                console.log(jsonQuery.substring(0, 300));
                return stdin.write(jsonQuery);
            }
        })(merlin.stdin, merlin.stdout));
    
    let mkQuery = (path, q) => ({
        context: ["auto", path],
        query: q
    });
    
    let txtPos = (line, col) => ({line: line + 1, col: col});
    
    let rxPos = p => [p.line - 1, p.col];
    
    let syncFile = path => 
      [mkQuery(path, ["tell", "start", "at", txPos(0, 0)]), mkQuery(path, ["tell", "file-eof", path])];
      
    let syncBuffer = (path, text) =>
        [mkQuery(path, ["tell", "start", "at", txPos(0, 0)]), mkQuery(path, ["tell", "source-eof", text])];
    
    // TODO: update this to fit vscode
    let syncAll = (documents, root) =>
        queryMerlin(documents.map(d => {
            var p = path.join(root, doc.fileName);
            return doc.isDirty ? syncBuffer(p, doc.getText()) : syncFile(p);
        }))
    
    let getTypeAt = (filename, pos, documents, root) =>
        syncAll(documents, root).then(() =>
            queryMerlin(mkQuery(path.join(root, filename), 
                ["type", "enclosing", "at", txPos(pos.line, pos.character)]))
            .then((resp) => {
                var jsonResp = JSON.stringify(resp);
                console.log("Resp: " + jsonResp);
                return resp;
            }));
    
    return {
        restartMerlinProcess,
        syncFile,
        syncBuffer,
        syncAll,
        getTypeAt
    };
}