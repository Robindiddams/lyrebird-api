const path = require('path');
const slsw = require('serverless-webpack');

const entries = {};

Object.keys(slsw.lib.entries).forEach(
  key => (entries[key] = ['./source-map-install.js', slsw.lib.entries[key]])
);

module.exports = {
	entry: entries,
	mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
	resolve: {
		extensions: [
			'.js',
			'.json',
			'.ts',
			'.tsx'
		]
	},
	output: {
		libraryTarget: 'commonjs',
		path: path.join(__dirname, '.webpack'),
		filename: '[name].js'
	},
	target: 'node',
	module: {
		rules: [
			{
				test: /\.ts(x?)$/,
				use: [
					{
						loader: 'ts-loader'
					}
				],
			}
		]
	}
};