/*eslint-env node */
module.exports = function(karma) {
	var reporters = process.env.TRAVIS ? ['dots', 'coverage', 'coveralls'] : ['mocha', 'coverage'];

	karma.set({
		frameworks: [ 'browserify', 'jasmine'],
		preprocessors: {
			'src/js/*.js': ['browserify'],
			'test/*.js': ['browserify']
		},
		browserify: {
			debug: true,
			transform: [
				[ 'babelify' ]
			]
		},
		files: [
			'src/js/*.js',
			'test/*.js'
		],
		reporters: reporters,
		coverageReporter: {
			reporters: [
				{ type: 'lcov', dir: 'coverage/' },
				{ type: 'html' },
				{ type: 'text' }
			]
		},
		browsers: ['PhantomJS']
	});
};
