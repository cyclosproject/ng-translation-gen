ng-translation-gen: Translation message accessors generator for Angular 2+.
---

This project is a NPM module that generates TypeScript classes from a JSON file
containing the translation keys used by an application.

The translation values can later be set, allowing dynamic translations. The main
difference between this project and the excellent [ngx-translate](https://github.com/ngx-translate/core) is that this project prevents keys from
being referenced in code without being present in the translation file.

`ng-translation-gen` was created for [cyclos4-ui](https://github.com/cyclosproject/cyclos4-ui), and it is an excellent example of how it can be used.

## Rationale
The idea of this project is to overcome the problems we found regarding I18N in
an Angular 2 application:
- If using AOT compilation there is need for a separate application package for
  each language (and also serve each one separately);
- Lack of possibility to translate a string that is not in a template but in code;
- Switch between languages dinamically.

## How to generate the classes
In your project, run:
```bash
cd <your_angular2+_app_dir>
npm install ng-translation-gen --save-dev
npx ng-translation-gen [-i input_dir] [-o output_dir] [-m source=ClassName[:source2=ClassName2]...]
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

## How it works
Starting with version 1.0, given a file named `messages.json`, the following
files are generated (replace `messages` with the input name):

- `messages.ts`: Defines the interface with all accessors. Translation keys
  without arguments are generated as property getters, whereas keys with
  arguments are generated as methods;
- `messages-meta.ts`: Contains build-time metadata for the translations.
  Also provides access to the implementation of the `Messages` interface;
- `translations.ts`: Helper class supporting the implementations. This
  class is generated regardless of the number of input JSON files.

As the main working type is an interface, it cannot be directly provided
in Angular (as interfaces are build-time only TypeScript artifacts - they
don't exist in runtime). As such, a `Provider` / `InjectionToken` pair is
required. They are both exported in the main interface file, and are named
(still assuming the `messages` name): `MessagesInjectionToken` and
`MessagesProvider`.

So, in your module, you should add the `MessagesProvider`
to the `provides` section of your module, and inject it using the
`@Inject(MessagesToken)` decorator.

Finally you will have the interface / instance for your messages accessor,
but it still doesn't have any translations loaded. As such, in either your
`app.component` or in an initializer, you should load the translations and
initialize the messages instance, as shown in the next section.

## Usage example

This is a very simple project generated with Angular 11:

### src/i18n/messages.json

```json
{
  "title": "Test app",
  "body": {
    "salutation": "Welcome to {title}",
    "message": "It is now {time} of {date}."
  },
  "footer": "Footer: {0}, {1}, {2}"
}
```

### src/app/app.module.ts

```typescript
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { MessagesProvider } from './i18n/messages';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule
  ],
  providers: [
    MessagesProvider
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

### src/app/app.component.ts

```typescript
import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { Messages } from './i18n/messages';
import { MessagesInjectionToken } from './i18n/messages';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(
    @Inject(MessagesInjectionToken) public messages: Messages,
    private http: HttpClient
  ) {
  }

  ngOnInit(): void {
    // Fetch the actual translations
    this.http.get('i18n/messages.json').subscribe((keys: object) =>
      this.messages.$initialize(keys));
  }

  getDate(): string {
    return new Date().toLocaleDateString();
  }

  getTime(): string {
    return new Date().toLocaleTimeString();
  }
}
```

### src/app/app.component.html

```html
<ng-container *ngIf="messages.initialized$ | async">
  <h1>{{ messages.title }}</h1>
  <h3>{{ messages.body.salutation(messages.title) }}</h3>
  <p>{{
    messages.body.message({
    time: getTime(),
    date: getDate()
    }) }}</p>
  <footer>{{ messages.footer('a', 'b', 'c') }}</footer>
</ng-container>
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
- `argumentType`: Type for generated arguments. Defaults to `string`, but may be set
   to more permissive types, such as `string | number` or even `any`.
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
Running `npx ng-translation-gen --watch` will keep watching
modified files in the input directory and regenerating translations as the
files are modified on disk. This can speed up development.

## Merging localized translation files
Running `npx ng-translation-gen --merge` will process all
locales set in the configuration file, and process translated file in the
input directory, for each locale. Any missing keys are added, and any
stale keys are removed. This operation is meant to be executed at build
time, so the deployed files for all translations are all complete. If
run at development time, the other translation files will be filled up
with default values, and will be flagged by your SCM (such as GIT) for commit.
For development time, another approach is recommended, as stated below.

## Running the application in development while using incomplete translations
When developing the application, if you use incomplete translations, you will
see values as missing keys, such as `???key???`. Starting with version `0.5.0`
it is possible to set default values, so on development the default values
will be used for missing keys, at cost of another request (which is ok on
development time). For this, before loading the translation values, load the
default values, like this:

```typescript
/**
 * Factory function that loads the tranlations JSON before the application is initialized
 */
export function initializeMessages(
  http: HttpClient, messages: Messages, locale: string): Function {
  return async () => {
    const defaultFile = 'translations/messages.json';
    // Initialize the defaults if running in development mode
    if (isDevMode()) {
      messages.defaultValues = await http.get(defaultFile).toPromise();
    }
    // Then fetch the translation values and initialize
    const defaultLocale = 'en';
    const file = ((locale || defaultLocale) === 'en')
      ? defaultFile : `translations/messages.${locale}.json`;
    const translations = await http.get(file).toPromise();
    return messages.initialize(translations);
  };
}
```

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
    "start": "ng-translation-gen && npm run ng -- serve",
    "build": "ng-translation-gen && npm run ng -- build -prod"
  }
}
```

Notice that `npm run` requires double dashes (`--`) between the command and
its arguments.
