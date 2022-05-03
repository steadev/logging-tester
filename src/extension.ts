// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { TextDecoder } from 'util';
import * as vscode from 'vscode';

interface Params {
	[key: string]: any;
}

let testLoggingProvider: vscode.Disposable | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "logging-tester" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('logging-tester.testLogging', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		
		let testBase: Params[];
		const testJsonFile = await vscode.workspace.findFiles('**/logging-tester.json');
		if (Array.isArray(testJsonFile) && testJsonFile.length > 0) {
			const uri: vscode.Uri = vscode.Uri.file(testJsonFile[0].path);
			const file = await vscode.workspace.fs.readFile(uri);
			testBase = JSON.parse(new TextDecoder().decode(file));
		} else {
			return;
		}

		const codeFiles: vscode.Uri[] = await vscode.workspace.findFiles('**/src/app/**/*.ts', '**/node_modules/**');
		const filteredCodeFiles = codeFiles.filter(file => !/(spec.ts)|(module.ts)/.test(file.fsPath));
		const testerList: Params[] = await getTesterListFromFiles(filteredCodeFiles);
		const compareRes = compareWithStandardList(testBase, testerList);
		if (compareRes) {
			vscode.window.showInformationMessage('Logging Test SUCCEED');
		} else {
			vscode.window.showInformationMessage('Logging Test FAILED');
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (testLoggingProvider) {
		testLoggingProvider.dispose();
	}
}

function getTesterListFromFiles(fileUris: vscode.Uri[]): Promise<Params[]> {
	return new Promise((resolve) => {
		const testerList: Params[] = [];
		fileUris.forEach(async (file, index) => {
			const uri: vscode.Uri = vscode.Uri.file(file.path);
			const fileRes = await vscode.workspace.fs.readFile(uri);
			const decodedCode = new TextDecoder().decode(fileRes);
			// list of @loggingTester content
			const loggingTesterContentList = testerContentListOfCurrentFile(decodedCode);
			if (Array.isArray(loggingTesterContentList)) {
				loggingTesterContentList.forEach((testerContent) => {
					const contentList = testerContent.match(/@[a-z0-9A-Z -_'`]+:[a-zA-Z0-9 -_,'`]+/gi);
					let testerJson: Params | undefined;
					if (Array.isArray(contentList)) {
						contentList.forEach(item => {
							const [key, value] = item.replace('@', '').split(/[ ]*:[ ]*/);
							if (testerJson === undefined) {
								testerJson = {};
							}
							testerJson[key] = value;
						});
					}
					if (testerJson !== undefined) {
						testerList.push(testerJson);
					}
				});
			}
			if (index === fileUris.length - 1) {
				resolve(testerList);
			}
		});
	});
}

/** get Tester Content of a file */
function testerContentListOfCurrentFile(code: string): string[] {
	return code.match(/@loggingTester[@a-zA-Z -_,*:0-9'`\r\n]+/gi) ?? [];
}

function compareWithStandardList(standard: Params[], testerList: Params[]): boolean {
	let res = false;
	standard.forEach((standardItem) => {
		const compareRes = compareWithStandard(standardItem, testerList);
		res = compareRes;
	});
	testerList.forEach((tester) => {
		if (!tester.isInStandard) {
			vscode.window.showWarningMessage(`[NOT EXIST IN logging-tester.json] ${JSON.stringify(tester)}`);
		}
	});
	return res;
}

function compareWithStandard(standard: Params, testerList: Params[]): boolean {
	let res = true;
	Object.keys(standard).forEach((key) => {
		const standardValue = standard[key];
		let flag = false;
		testerList.forEach(tester => {
			const testerValue = tester[key];
			if (testerValue === standardValue) {
				flag = true;
				tester.isInStandard = true;
			}
		});
		res = flag;
	});
	if (!res) {
		vscode.window.showErrorMessage(`[NOT FOUND] ${JSON.stringify(standard)}`);
	}
	return res;
}