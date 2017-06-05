ng-translation-gen: Translation message accessors generator for Angular 2+.
---

This project is a NPM module that generates TypeScript classes from a JSON file
containing the translation keys used by an application.

## Rationale:
The idea of this project is to overcome the problems we found regarding I18N in 
an Angular 2 application:
- If using AOT compilation there is need for a separate application package for 
  each language (and also serve each one separately).
- Lack of possibility to translate a string that is not in a template but in code.
- Change from diferents translations dinamically.

## How to use it:
In your project, run:
```bash
cd <your_angular2+_app_dir>
npm install ng-translation-gen --save-dev
node_modules/.bin/ng-translation-gen [-i input_dir] [-o output_dir]
```
Where:

- `input_dir` is the directory where the translation files reside.
  The default inoput directory if nothing is specified is `src/app/translations`.
- `output_dir` is the directory where the generated code will be outputted. It
  is recommended that this directory is ignored on GIT (or whatever source
  control software you are using), for example, by adding its name to
  `.gitignore`. The default output directory if nothing is specified is
  `src/app/messages`.

Please, run the `ng-translation-gen` with the `--help` argument to view all
available command line arguments.

### Generated folder structure
The folder `src/app/messages` (or your custom folder) will contain the following
structure:

```
project_root
+- src
   +- app
      +- messages
         +- translations1-messages.ts
         +- ...
         +- translationsn-messages.ts
```

The files are:

- **messages/translation*n*-messages.ts**: One file per JSON translation file 
  in the input folder (or those mapped if a mapping is configured) and using the 
  default class suffix.

## Using a configuration file
On regular usage it is recommended to use a configuration file instead of
passing command-line arguments to `ng-translation-gen`. The configuration file 
name is `ng-translation-gen.json`, and should be placed on the root folder of your
NodeJS project. Besides allowing to omit the command-line arguments, using a
configuration file allows a greater degree of control over the generation.

An accompanying JSON schema is also available, so the configuration file can be
validated, and the IDE can autocomplete the file. If you have installed and
saved the `ng-translation-gen` module in your node project, you can use a local copy
of the JSON schema on `./node_modules/ng-translation-gen/ng-translation-gen-schema.json`.
It is also possible to use the online version at 
`https://github.com/cyclosproject/ng-translation-gen/blob/master/ng-translation-gen-schema.json`.

### Generating the configuration file
To generate a configuration file, run the following in the root folder of
your project;

```bash
ng-translation-gen --gen-config [-i input_dir] [-o output_dir]
```

This will generate the `ng-translation-gen.json` file in the current directory
with the property defaults, plus the input and output directories that were specified together. Both are optional, and the file is generated anyway.

### Configuration file reference
The supported properties in the JSON file are:

- `input`: Folder containing the translation JSON files to read from.
  Defaults to `src/app/translations`.
- `output`: Folder where the generated TS clases will be placed. 
  Defaults to `src/app/messages`.
- `mapping`: A mappig from translation file name to TS class name.
- `includeOnlyMappedFiles`: If true only the files present in the mapping 
  property will be processed. Defaults to true.
- `classSuffix`: Suffix added to the generated class if not found in the mapping.
  Defaults to `Messages`.
- `templates`: Path to the folder containing the Mustache templates used to 
  generate the clases.

### Configuration file example
The following is a simple example of a configuration file:
```json
{
  "$schema": "./node_modules/ng-translation-gen/ng-translation-gen-schema.json",
  "input": "src/assets",
  "output": "src/app/messages",
  "includeOnlyMappedFiles": true,
  "mapping": {
    "access": "MyAccess"
  }
}
```

This will only read a file named `access` (whatever extension) from the 
`src/assets` folder and the generated class (`MyAccessMessages`) will be saved 
in `src/app/messages`.

## Setting up a node script
Regardless If your Angular project was generated or is managed by
[Angular CLI](https://cli.angular.io/), or you have started your project with
some other seed (for example, using [webpack](https://webpack.js.org/)
directly), you can setup a script to make sure the generated classes are
consistent with the JSON translations file.

To do so, create the `ng-translation-gen.json` configuration file and add the
following `scripts` to your `package.json`:
```json
{
  "scripts": {
    "ng-translation-gen": "ng-translation-gen",
    "start": "ng-translation-gen && ng serve",
    "build": "ng-translation-gen && ng build -prod"
  }
}
```