import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

// Extension bundle (Node.js)
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: !isWatch,
};

// Webview bundle (Browser) — results panel
const webviewResultsConfig = {
  entryPoints: ['src/webview/results-panel/index.tsx'],
  bundle: true,
  outfile: 'dist/webview/results-panel.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  minify: !isWatch,
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
};

// Webview bundle (Browser) — metadata panel
const webviewMetadataConfig = {
  entryPoints: ['src/webview/metadata-panel/index.tsx'],
  bundle: true,
  outfile: 'dist/webview/metadata-panel.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  minify: !isWatch,
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
};

async function build() {
  try {
    if (isWatch) {
      const contexts = await Promise.all([
        esbuild.context(extensionConfig),
        esbuild.context(webviewResultsConfig),
        esbuild.context(webviewMetadataConfig),
      ]);
      await Promise.all(contexts.map(ctx => ctx.watch()));
      console.log('Watching for changes...');
    } else {
      await Promise.all([
        esbuild.build(extensionConfig),
        esbuild.build(webviewResultsConfig),
        esbuild.build(webviewMetadataConfig),
      ]);
      console.log('Build complete.');
    }
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

build();
