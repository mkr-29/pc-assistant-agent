import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import test from 'node:test';
import { createProjectTools } from '../../src/tools/implementations/projectTools.js';

function createTempDirectory() {
    const tempRoot = path.join(process.cwd(), '.data');
    fs.mkdirSync(tempRoot, { recursive: true });

    return fs.mkdtempSync(path.join(tempRoot, 'test-project-tools-'));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function createTools(rootPath) {
    return createProjectTools({
        resolveToolPath: inputPath => inputPath ? path.resolve(rootPath, inputPath) : rootPath
    });
}

function installFakeGit(t, script) {
    const rootPath = createTempDirectory();
    const binPath = path.join(rootPath, 'bin');
    const gitPath = path.join(binPath, 'git');
    const originalPath = process.env.PATH;

    fs.mkdirSync(binPath, { recursive: true });
    fs.writeFileSync(gitPath, script, 'utf-8');
    fs.chmodSync(gitPath, 0o755);
    process.env.PATH = `${binPath}${path.delimiter}${originalPath || ''}`;

    t.after(() => {
        process.env.PATH = originalPath;
        fs.rmSync(rootPath, { recursive: true, force: true });
    });
}

test('inspectProject detects Node package scripts', async t => {
    const rootPath = createTempDirectory();
    t.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));
    writeJson(path.join(rootPath, 'package.json'), {
        name: 'sample-project',
        scripts: {
            test: 'node --test',
            lint: 'eslint .'
        }
    });

    const tools = createTools(rootPath);
    const result = await tools.inspectProject({});

    assert.equal(result.status, 'ok');
    assert.equal(result.packageName, 'sample-project');
    assert.deepEqual(result.projectTypes, ['node']);
    assert.equal(result.suggestedCommands.test, 'npm test');
    assert.equal(result.suggestedCommands.lint, 'npm run lint');
});

test('runProjectLint reports not_configured when no lint script exists', async t => {
    const rootPath = createTempDirectory();
    t.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));
    writeJson(path.join(rootPath, 'package.json'), {
        scripts: {
            test: 'node --test'
        }
    });

    const tools = createTools(rootPath);
    const result = await tools.runProjectLint({});

    assert.equal(result.status, 'not_configured');
    assert.match(result.message, /No lint script/);
});

test('runProjectTests returns failed status when the test script fails', async t => {
    const rootPath = createTempDirectory();
    t.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));
    writeJson(path.join(rootPath, 'package.json'), {
        scripts: {
            test: 'node missing-test-file.js'
        }
    });

    const tools = createTools(rootPath);
    const result = await tools.runProjectTests({ timeoutMs: 10000 });

    assert.equal(result.status, 'failed');
    assert.equal(result.command, 'npm test');
    assert.notEqual(result.exitCode, 0);
});

test('getGitStatus reports not_git_repo for non-repository directories', async t => {
    const rootPath = createTempDirectory();
    t.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));
    installFakeGit(t, `#!/bin/sh
if [ "$1" = "rev-parse" ] && [ "$2" = "--show-toplevel" ]; then
  echo "fatal: not a git repository" >&2
  exit 128
fi
exit 1
`);

    const tools = createTools(rootPath);
    const result = await tools.getGitStatus({});

    assert.equal(result.status, 'not_git_repo');
});

test('summarizeGitDiff returns bounded unstaged diff data', async t => {
    const rootPath = createTempDirectory();
    t.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));
    installFakeGit(t, `#!/bin/sh
if [ "$1" = "rev-parse" ] && [ "$2" = "--show-toplevel" ]; then
  pwd
  exit 0
fi
if [ "$1" = "diff" ] && [ "$2" = "--stat" ]; then
  echo " notes.txt | 300 ++++++++++++++++++++++++++++++"
  exit 0
fi
if [ "$1" = "diff" ] && [ "$2" = "--name-status" ]; then
  printf "M\\tnotes.txt\\n"
  exit 0
fi
if [ "$1" = "diff" ]; then
  i=0
  while [ "$i" -lt 300 ]; do
    echo "+changed line"
    i=$((i + 1))
  done
  exit 0
fi
exit 1
`);

    const tools = createTools(rootPath);
    const result = await tools.summarizeGitDiff({ scope: 'unstaged', maxDiffChars: 1000 });

    assert.equal(result.status, 'ok');
    assert.deepEqual(result.diffs.unstaged.files, [{ status: 'M', path: 'notes.txt' }]);
    assert.equal(result.diffs.unstaged.truncated, true);
    assert.ok(result.diffs.unstaged.diff.length <= 1000);
});

test('createGitCommit refuses to run without explicit confirmation', async t => {
    const rootPath = createTempDirectory();
    t.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));

    const tools = createTools(rootPath);
    const result = await tools.createGitCommit({
        message: 'Commit without confirmation',
        confirmed: false
    });

    assert.equal(result.status, 'confirmation_required');
});

test('createGitCommit rejects obvious secret files', async t => {
    const rootPath = createTempDirectory();
    t.after(() => fs.rmSync(rootPath, { recursive: true, force: true }));
    installFakeGit(t, `#!/bin/sh
if [ "$1" = "rev-parse" ] && [ "$2" = "--show-toplevel" ]; then
  pwd
  exit 0
fi
exit 1
`);
    fs.writeFileSync(path.join(rootPath, '.env'), 'TOKEN=secret\n', 'utf-8');

    const tools = createTools(rootPath);
    const result = await tools.createGitCommit({
        message: 'Add env',
        files: ['.env'],
        confirmed: true
    });

    assert.equal(result.status, 'rejected_secret_files');
    assert.deepEqual(result.files, ['.env']);
});
