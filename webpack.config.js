var path = require('path');

module.exports = {
	entry: {
		bundle: "./src/index.js",
		new: "./src/new.js",
		client: "./src/client.js",
	},
	output: {
		path: path.join(__dirname, "dist"),
		filename: "[name].js"
	},
	module: {
		loaders: [
			{ test: /\.js$/, exclude: /node_modules/, loader: "babel-loader"}
		]
	}
};
