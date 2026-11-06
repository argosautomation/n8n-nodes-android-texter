const { src, dest } = require('gulp');

// n8n loads node icons by file path relative to the compiled JS, so SVGs
// from each node directory need to land in the corresponding dist/ folder.
// The credential's icon lives next to it and lands in dist/credentials.
function buildIcons() {
	src('credentials/**/*.svg').pipe(dest('dist/credentials'));
	return src('nodes/**/*.svg').pipe(dest('dist/nodes'));
}

exports['build:icons'] = buildIcons;
