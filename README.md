ng-translation-gen: Translation message accessors generator for Angular 2+.
---

This project is a NPM module that generates TypeScript classes from a JSON file
containing the translation keys used by an application.

The translation values can later be set, allowing dynamic translations. The main
difference between this project and the excellent [ngx-translate](https://github.com/ngx-translate/core) is that this project prevents keys from
being referenced in code without being present in the translation file.

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
node_modules/.bin/ng-translation-gen [-i input_dir] [-o output_dir] [-m source=ClassName[:source2=ClassName2]...]
```
Where:

- `input_dir` is the directory where the translation files reside.
  The default inoput directory if nothing is specified is `src/translations`;
- `output_dir` is the directory where the generated code will be outputted. It
  is recommended that this directory is ignored on GIT (or whatever source
  control software you are using), for example, by adding its name to
  `.gitignore`. The default output directory if nothing is specified is
  `src/app/messages`;
- `mapping` contains the JSON file name (inside the given input dir) and the
  generated class name (on the output dir), in the form 
  `file1=Class1:file2=Class2`.

Please, run the `ng-translation-gen` with the `--help` argument to view all
available command line arguments.

See [Using a configuration file](#using-a-configuration-file) for an easier
usage with a configuration file, so the parameters don't need to be specified
all the time.

## How to use it in your Angular project:

This is an example of the default Angular application (generated by
`ng new`) with the keys translated:

### src/translations/messages.json

```json
{
  "title": "Application title",
  "welcome": "Welcome to {title}",
  "links": {
    "title": "Here are some links to help you start:",
    "tourOfHeroes": "Tour of Heroes",
    "cli": "CLI Documentation",
    "blog": "Angular blog"
  }
}
```

### src/app/app.module.ts

```typescript
import { BrowserModule } from '@angular/platform-browser';
import { NgModule, APP_INITIALIZER } from '@angular/core';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { AppComponent } from './app.component';
import { Messages } from './messages/messages';
import { Provider } from '@angular/compiler/src/core';

/**
 * Factory function that loads the tranlations JSON before the application is initialized
 */
export function initializeMessages(http: HttpClient, messages: Messages): Function {
  return async () => {
    const translations = await http.get('translations/messages.json').toPromise();
    return messages.initialize(translations);
  };
}

/**
 * Provider descriptor for the initializer factory
 */
export const INITIALIZE_MESSAGES_PROVIDER: Provider = {
  provide: APP_INITIALIZER,
  useFactory: initializeMessages,
  deps: [HttpClient, Messages],
  multi: true
};

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule
  ],
  providers: [
    Messages,
    INITIALIZE_MESSAGES_PROVIDER
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

### src/app/app.component.ts

```typescript
import { Component, OnInit } from '@angular/core';
import { Messages } from './messages/messages';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title: string;

  // Inject the messages, so it can be used both here and on the template
  constructor(public messages: Messages) {
  }

  ngOnInit() {
    // Using a translation in TypeScript code
    this.title = this.messages.title;
  }
}
```

### src/app/app.component.html

```html
<div style="text-align:center">
  <h1>
    {{ messages.welcome(title)}}
  </h1>
  <!-- image is removed as its content was inline -->
</div>
<h2>{{ messages.links.title }}</h2>
<ul>
  <li>
    <h2><a target="_blank" rel="noopener" href="https://angular.io/tutorial">{{ messages.links.tourOfHeroes }}</a></h2>
  </li>
  <li>
    <h2><a target="_blank" rel="noopener" href="https://angular.io/cli">{{ messages.links.cli }}</a></h2>
  </li>
  <li>
    <h2><a target="_blank" rel="noopener" href="https://blog.angular.io/">{{ messages.links.blog }}</a></h2>
  </li>
</ul>
```

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
ng-translation-gen --gen-config [-i input_dir] [-o output_dir] [-m source=ClassName[:source2=ClassName2]...]
```

This will generate the `ng-translation-gen.json` file in the current directory
with the property defaults, plus the input and output directories and mapping that were specified.

### Configuration file reference
The supported properties in the JSON file are:

- `input`: Folder containing the translation JSON files to read from.
  Defaults to `src/translations`;
- `output`: Folder where the generated TS clases will be placed.
  Defaults to `src/app/messages`;
- `mapping`: A mapping from a base name (JSON file without extension) to the TS
  class name. Must be in the form: `file1=Class1:file2=Class2:...`;
- `defaultLocale`: Identifier for the default locale, that means, the one which
  the file name without locale specification follows. Defaults to `en`;
- `locales`: Array with the list of locales for which the application should have
  a translation;
- `separator`: Separator used between the base name and the locale specification
  used for files. Defaults to `.`. So, for example, if the base name is
  `messages` and the locale is `pt-BR`, the final file would be named
  `messages.pt-BR.json`.

### Configuration file example
The following is a simple example of a configuration file:
```json
{
  "$schema": "./node_modules/ng-translation-gen/ng-translation-gen-schema.json",
  "input": "src/assets",
  "output": "src/app/messages",
  "includeOnlyMappedFiles": true,
  "mapping": {
    "dashboard": "DashboardMessages",
    "user": "UserMessages",
    "admin": "AdminMessages"
  }
}
```

## Starting in watch mode
Running `node_modules/.bin/ng-translation-gen --watch` will keep watching
modified files in the input directory and regenerating translations as the
files are modified on disk. This can speed up development.

## Merging localized translation files
Running `node_modules/.bin/ng-translation-gen --merge` will process all
locales set in the configuration file, and process translated file in the
input directory, for each locale. Any missing keys are added, and any
stale keys are removed.

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
    "ng": "ng",
    "ng-translation-gen": "ng-translation-gen",
    "start": "npm run ng-translation-gen && npm run ng -- serve",
    "build": "npm run ng-translation-gen && npm run ng -- build -prod"
  }
}
```

Notice that `npm run` requires double dashes (`--`) between the command and
its arguments.
