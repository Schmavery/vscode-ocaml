var vscode = require('vscode');
var cp = require('child_process');
var Merlin = require('./merlin');
var window = vscode.window;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

var merlin;
function activate(context) {
    console.log("Activated!")
    merlin = Merlin(vscode.workspace.getConfiguration('ocaml')['merlinPath']);
    merlin.restartMerlinProcess();
    
    vscode.languages.registerHoverProvider(['*', 'ocaml'],
        {provideHover: (document, position, token) => {
            //return new vscode.Hover([{language: 'ocaml', value: 'let x = 2'}]);
            console.log("before")
            try{
            return merlin.getTypeAt(
                document.fileName, 
                position,
                vscode.workspace.textDocuments).then(v => {
                    console.log("STUFFF>>", res, typeof res);        
                    return new vscode.Hover([{language: 'ocaml', value: 'let x = 2'}]);
                });
            } catch (e) {console.log(e)}
        }}
    );
    
    
    vscode.workspace.onDidSaveTextDocument((doc) => {
        var b = (doc.languageId === 'ocaml' && vscode.workspace.getConfiguration('ocaml')['indentOnSave']);
        if (b) reformat();
    });
    
    var disposable = vscode.commands.registerCommand('extension.format', function () {
        reformat();
    });
}

function deactivate(){
    merlin.kill();
}

exports.activate = activate;
exports.deactivate = deactivate;

function reformat(){
    console.log("Formatting...");
    var fmtPath = vscode.workspace.getConfiguration('ocaml')['formatToolPath'];
    var filename = vscode.window.activeTextEditor.document.fileName;
    cp.execFile(fmtPath, [filename], {}, (err, stdout, stderr) => {
        if (vscode.window.activeTextEditor.document.getText() != stdout)
            setText(vscode.window.activeTextEditor, stdout);
    });
}

function setText(editor, text){
    editor.edit(builder => {
        const document = editor.document;
        const lastLine = document.lineAt(document.lineCount - 1);

        const start = new vscode.Position(0, 0);
        const end = new vscode.Position(document.lineCount - 1, lastLine.text.length);
        builder.replace(new vscode.Range(start, end), text);
    });
}