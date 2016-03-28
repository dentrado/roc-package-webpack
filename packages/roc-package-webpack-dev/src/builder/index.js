import { join } from 'path';
import { yellow, underline } from 'chalk';

import { getSettings, getAbsolutePath, fileExists } from 'roc';
import { getValueFromPotentialObject } from 'roc-package-base-dev';

import runThroughBabel from '../helpers/run-through-babel';
import { writeStats } from './utils/stats';

/**
 * Creates a builder.
 *
 * @param {!string} target - a target: should be either "client" or "server"
 * @param {rocBuilder} rocBuilder - A rocBuilder to base everything on.
 * @returns {rocBuilder}
 */
export default ({ previousValue: { buildConfig = {}, builder = require('webpack') }}) => (target) => () => {
    const buildSettings = getSettings('build');

    const DEV = (buildSettings.mode === 'dev');
    const DIST = (buildSettings.mode === 'dist');

    const ENV = DIST ? 'production' : 'development';

    const entry = getAbsolutePath(getValueFromPotentialObject(buildSettings.input, target));
    const outputPath = getAbsolutePath(getValueFromPotentialObject(buildSettings.output, target));
    const outputName = getValueFromPotentialObject(buildSettings.outputName, target);

    if (!fileExists(entry)) {
        console.log(yellow(`Could not find the entry file for ${underline(target)} at ` +
            `${underline(entry)}`));

        return {};
    }

    if (DIST) {
        buildConfig.bail = true;
    }

    /**
    * Entry
    */
    buildConfig.entry = {
        [outputName]: [
            entry
        ]
    };

    /**
    * Devtool
    */
    buildConfig.devtool = 'source-map';

    /**
    * Output
    */
    buildConfig.output = {
        path: outputPath,
        filename: '[name].roc.js',
        chunkFilename: '[name].roc.js'
    };

    /**
    * Loaders
    */

    // Base
    buildConfig.module = {
        preLoaders: [],
        loaders: []
    };

    // JS LOADER
    const jsLoader = {
        test: /\.js$/,
        loader: 'babel-loader',
        query: {
            cacheDirectory: true,
            presets: [
                require.resolve('babel-preset-es2015'),
                require.resolve('babel-preset-stage-1')
            ],
            plugins: [
                require.resolve('babel-plugin-transform-runtime'),
                require.resolve('babel-plugin-transform-decorators-legacy')
            ]
        },
        include: runThroughBabel
    };

    buildConfig.module.loaders.push(jsLoader);

    // JSON LOADER
    const jsonLoader = {
        test: /\.json$/,
        loader: 'json-loader'
    };

    buildConfig.module.loaders.push(jsonLoader);

    /**
    * Resolve
    */
    buildConfig.resolve = {
        fallback: [],
        extensions: ['', '.js']
    };

    buildConfig.resolveLoader = {
        root: [
            join(__dirname, '..', '..', 'node_modules')
        ]
    };

    /**
    * Plugins
    */
    buildConfig.plugins = [];

    buildConfig.plugins.push(
        // process.env.NODE_ENV is used by React and some other libs to determine what to run
        new builder.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(ENV),
            '__DEV__': DEV,
            '__DIST__': DIST
        })
    );

    if (DIST) {
        buildConfig.plugins.push(function() {
            this.plugin('done', writeStats);
        });

        buildConfig.plugins.push(
            new builder.optimize.DedupePlugin(),
            new builder.optimize.OccurenceOrderPlugin()
        );
    }

    return {
        buildConfig,
        builder,
        info: {
            entry,
            outputName,
            outputPath
        }
    };
};