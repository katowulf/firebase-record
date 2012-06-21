Modifying the Bootstrap CSS
===========================

1. Install LESS
------
If you haven't already, install LESS to your machine via NPM. More information on that here: http://lesscss.org/#-server-side-usage

`npm install -g less`

2. Upgrade Bootstrap (optional)
------

a. Download a new version of bootstrap
=====
1. The simplest way to do compile and download it from the [Bootstrap Download Page](http://twitter.github.com/bootstrap/download.html#variables)
2. Click on Customize and Download at the bottom (this produces a compiled version of the JavaScript code with matching CSS less files)

b. Update Bootstrap JS
=====

`cp downloads/bootstrap/js/bootstrap*.js lib/bootstrap/js`

c. Update Bootstrap less files
=====

`cp downloads/bootstrap/less/* lib/bootstrap/less/bootstrap/less`

d. Integrate Font-Awesome
=====
1. Download the latest build from font-awesome
2. Copy the .less file to `bootstrap/less/font-awesome.less`.
3. Copy the font folder to `bootstrap/font`.
4. Modify `@fontAwesomePath` to point to the fonts folder (probably `@fontAwesomePath: '../font';`)
5. Open bootstrap/less/bootstrap.less and replace `@import 'sprites.less'` with `@import 'font-awesome.less'`

3. Customize Bootstrap
------
Make your customizations to the two files found in `lib/bootstrap/less/swatch` directory, `variables.less` and `bootswatch.less`.

These files are a slightly modified version of the [Simplex](http://bootswatch.com/simplex/) theme from [Bootswatch](http://bootswatch.com/)

Changes made:
* replaced all references to 11px with .9em

4. Build Customized Bootstrap
------
In terminal, navigate to the `lib/bootstrap/less` directory and run `make bootswatch`.

The compiled CSS files will overwrite `lib/bootstrap/css/bootstrap.css` and `lib/bootstrap/css/bootstrap.min.css`.

