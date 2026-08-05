import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {
    classifyFileWrite,
    classifyTerminalCommand,
    isSensitivePath,
    tokenizeCommand
} from '../../src/approvals/dangerousActionDetector.js';

test('classifyTerminalCommand allows routine read-only commands', () => {
    for (const command of ['npm test', 'ls -la', 'git status']) {
        const result = classifyTerminalCommand(command);

        assert.equal(result.requiresApproval, false, command);
        assert.equal(result.category, 'safe');
    }
});

test('classifyTerminalCommand flags dangerous terminal categories', () => {
    const cases = [
        ['rm -rf ./tmp', 'deletion'],
        ['find . -delete', 'deletion'],
        ['git reset --hard HEAD', 'deletion'],
        ['npm install left-pad', 'install'],
        ['python -m pip install requests', 'install'],
        ['kill -9 1234', 'process'],
        ['docker stop app', 'process'],
        ['sed -i "" "s/a/b/g" src/*.js', 'bulk_modification'],
        ['find . -name "*.js" -exec perl -pi -e "s/a/b/g" {} \\;', 'bulk_modification'],
        ['rsync -a --delete source/ dest/', 'bulk_modification']
    ];

    for (const [command, category] of cases) {
        const result = classifyTerminalCommand(command);

        assert.equal(result.requiresApproval, true, command);
        assert.equal(result.category, category, command);
    }
});

test('tokenizeCommand respects quoted command arguments', () => {
    assert.deepEqual(
        tokenizeCommand('sed -i "" "s/hello world/bye/g" file.js'),
        ['sed', '-i', 's/hello world/bye/g', 'file.js']
    );
});

test('classifyFileWrite flags sensitive, outside-project, and bulk writes', () => {
    const projectPath = path.resolve('/tmp/project');

    assert.equal(isSensitivePath('/tmp/project/.env'), true);

    assert.equal(
        classifyFileWrite({
            filePath: '.env',
            resolvedPath: path.join(projectPath, '.env'),
            targetProjectPath: projectPath
        }).category,
        'sensitive_file'
    );

    assert.equal(
        classifyFileWrite({
            filePath: '../outside.txt',
            resolvedPath: path.resolve('/tmp/outside.txt'),
            targetProjectPath: projectPath
        }).category,
        'outside_project'
    );

    const writtenFilePaths = new Set([
        path.join(projectPath, 'one.txt'),
        path.join(projectPath, 'two.txt')
    ]);

    assert.equal(
        classifyFileWrite({
            filePath: 'three.txt',
            resolvedPath: path.join(projectPath, 'three.txt'),
            targetProjectPath: projectPath,
            writtenFilePaths,
            manyFileThreshold: 2
        }).category,
        'bulk_file_write'
    );

    assert.equal(
        classifyFileWrite({
            filePath: 'four.txt',
            resolvedPath: path.join(projectPath, 'four.txt'),
            targetProjectPath: projectPath,
            writtenFilePaths,
            manyFileThreshold: 2,
            bulkWriteApproved: true
        }).requiresApproval,
        false
    );
});
