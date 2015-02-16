var gulp = require('gulp'); 
var gutil = require('gutil'); 
var coffee = require('gulp-coffee');
var beep = require('beepbeep');
var insert = require('gulp-insert');

gulp.task('coffee', function () {
  gulp.src('./src/pagepipe.coffee')
    .pipe(coffee({bare: true}).on('error', function (err) {
      beep(2, 500);
      gutil.log(err);
    }))
    .pipe(insert.prepend('#!/usr/bin/env node\n\n'))
    .pipe(gulp.dest('./bin/'))
});

gulp.task('watch-coffee', function () {
  gulp.watch(['./src/*.coffee'], ['coffee']);
});

gulp.task('default', ['coffee', 'watch-coffee']);
