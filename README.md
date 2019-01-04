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

## How to generate the classes:
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

## How to use it in your Angular project:
Define a module as follow:
```typescript
import { BrowserModule } from '@angular/platform-browser';
import { NgModule, Provider, APP_INITIALIZER } from '@angular/core';
import { HttpModule, Http } from '@angular/http';

import { SystemMessages } from 'app/messages/system-messages';
import { AccessMessages } from 'app/messages/access-messages';


import { AppComponent } from './app.component';

import 'rxjs/add/operator/toPromise';

/**
 * This function will be executed when the application is initialized.
 * It loads the system translations.
 */
export function loadSystemMessages(system: SystemMessages, http: Http): Function {
  return () => http.get("assets/system-messages.json")
    .toPromise()
    .then(response => {
      system.initialize(response.json());
    })
    .catch(e => alert(e));
}

const SYSTEM_MESSAGES: Provider = {
  provide: APP_INITIALIZER,
  useFactory: loadSystemMessages,
  deps: [
    SystemMessages,
    Http
  ],
  multi: true
}

/**
 * This function will be executed when the application is initialized.
 * It loads the access translations.
 */
export function loadAccessMessages(access: AccessMessages, http: Http): Function {
  return () => http.get("assets/access-messages.json")
    .toPromise()
    .then(response => {
      access.initialize(response.json());
    })
    .catch(e => alert(e));
}

const ACCESS_MESSAGES: Provider = {
  provide: APP_INITIALIZER,
  useFactory: loadAccessMessages,
  deps: [
    AccessMessages,
    Http
  ],
  multi: true
}

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    HttpModule
  ],
  bootstrap: [AppComponent],
  providers: [
    SystemMessages,
    AccessMessages,
    ACCESS_MESSAGES,
    SYSTEM_MESSAGES
  ]
})
export class AppModule { }
```
Now put this code in your component:
```typescript
import { Component } from '@angular/core';
import {AccessMessages} from 'app/messages/access-messages';
import {SystemMessages} from 'app/messages/system-messages';

@Component({
  selector: 'app-root',
    template: `
    <h1>{{systemMessages.greetings('Michael')}}</h1>
  `
})
export class AppComponent {
  constructor(
    public systemMessages: SystemMessages,
    public accessMessages: AccessMessages,
  ) {}
}
```
Finally, if you ran the generator using this translation file:
```json
{
  "greetings": "Welcome {user}"
}
```
You will see get the following output:
```html
<h1>Welcome Michael</h1>
```

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
  Defaults to `src/translations`.
- `output`: Folder where the generated TS clases will be placed.
  Defaults to `src/app/messages`.
- `mapping`: A mapping from JSON file (without extension) to the TS class name.
  Must be in the form: `file1=Class1:file2=Class2:...`.
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