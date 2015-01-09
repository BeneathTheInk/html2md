module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		clean: [ "dist/*.js" ],
		browserify: {
			dist: {
				src: "lib/html2md.js",
				dest: "dist/html2md.js",
				options: {
					browserifyOptions: { standalone: "html2md" }
				}
			},
			dev: {
				src: "lib/html2md.js",
				dest: "dist/html2md.dev.js",
				options: {
					browserifyOptions: { debug: true, standalone: "html2md" }
				}
			},
			test: {
				src: "test/*.js",
				dest: "dist/html2md.test.js",
				options: {
					browserifyOptions: { debug: true, require: [  ] }
				}
			}
		},
		wrap2000: {
			dist: {
				src: 'dist/html2md.js',
				dest: 'dist/html2md.js',
				options: {
					header: "/*\n * html2md\n * (c) 2014 Beneath the Ink, Inc.\n * MIT License\n * Version <%= pkg.version %>\n */\n"
				}
			},
			dev: {
				src: 'dist/html2md.dev.js',
				dest: 'dist/html2md.dev.js',
				options: {
					header: "/* html2md / (c) 2014 Beneath the Ink, Inc. / MIT License / Version <%= pkg.version %> */"
				}
			},
			test: {
				src: 'dist/html2md.test.js',
				dest: 'dist/html2md.test.js',
				options: {
					header: "/* html2md / (c) 2014 Beneath the Ink, Inc. / MIT License / Version <%= pkg.version %> */"
				}
			}
		},
		uglify: {
			dist: {
				src: "dist/html2md.js",
				dest: "dist/html2md.min.js"
			}
		},
		watch: {
			test: {
				files: [ "lib/**/*", "test/*.js" ],
				tasks: [ 'test' ],
				options: { spawn: false }
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-browserify');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-wrap2000');

	grunt.registerTask('compile-dev', [ 'browserify:dev', 'wrap2000:dev' ]);
	grunt.registerTask('compile-test', [ 'browserify:test', 'wrap2000:test' ]);
	grunt.registerTask('compile-dist', [ 'browserify:dist', 'wrap2000:dist', 'uglify:dist' ]);

	grunt.registerTask('build-dev', [ 'clean', 'compile-dev' ]);
	grunt.registerTask('build-test', [ 'clean', 'compile-test' ]);
	grunt.registerTask('build-dist', [ 'clean', 'compile-dist' ]);

	grunt.registerTask('dev', [ 'build-dev' ]);
	grunt.registerTask('test', [ 'build-test', 'watch:test' ]);
	grunt.registerTask('dist', [ 'build-dist'  ]);

	grunt.registerTask('default', [ 'clean', 'compile-dist', 'compile-dev' ]);

}
