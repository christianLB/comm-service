## @k2600x/comm-service-sdk@0.1.0

This generator creates TypeScript/JavaScript client that utilizes [axios](https://github.com/axios/axios). The generated Node module can be used in the following environments:

Environment
* Node.js
* Webpack
* Browserify

Language level
* ES5 - you must have a Promises/A+ library installed
* ES6

Module system
* CommonJS
* ES6 module system

It can be used in both TypeScript and JavaScript. In TypeScript, the definition will be automatically resolved via `package.json`. ([Reference](https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html))

### Building

To build and compile the typescript sources to javascript use:
```
npm install
npm run build
```

### Publishing

First build the package then run `npm publish`

### Consuming

navigate to the folder of your consuming project and run one of the following commands.

_published:_

```
npm install @k2600x/comm-service-sdk@0.1.0 --save
```

_unPublished (not recommended):_

```
npm install PATH_TO_GENERATED_PACKAGE --save
```

### Documentation for API Endpoints

All URIs are relative to *http://localhost:8080*

Class | Method | HTTP request | Description
------------ | ------------- | ------------- | -------------
*CommandsApi* | [**v1CommandsDispatchPost**](docs/CommandsApi.md#v1commandsdispatchpost) | **POST** /v1/commands/dispatch | Despachar comando a un servicio (con opción de confirmación Sí/No)
*EventsApi* | [**v1EventsPost**](docs/EventsApi.md#v1eventspost) | **POST** /v1/events | Ingesta de eventos desde servicios (status de comandos, outputs)
*HealthApi* | [**healthGet**](docs/HealthApi.md#healthget) | **GET** /health | Health probe
*MessagesApi* | [**v1MessagesSendPost**](docs/MessagesApi.md#v1messagessendpost) | **POST** /v1/messages/send | Enviar notificación (Telegram/Email/Auto) con fallback y TTL
*VerificationApi* | [**v1VerificationConfirmPost**](docs/VerificationApi.md#v1verificationconfirmpost) | **POST** /v1/verification/confirm | Confirmar OTP o token de magic link
*VerificationApi* | [**v1VerificationStartPost**](docs/VerificationApi.md#v1verificationstartpost) | **POST** /v1/verification/start | Iniciar verificación por email o telegram (OTP o magic link)


### Documentation For Models

 - [Channel](docs/Channel.md)
 - [CommandAccepted](docs/CommandAccepted.md)
 - [CommandDispatchRequest](docs/CommandDispatchRequest.md)
 - [CommandDispatchRequestAudit](docs/CommandDispatchRequestAudit.md)
 - [EventIn](docs/EventIn.md)
 - [EventInMetrics](docs/EventInMetrics.md)
 - [HealthStatus](docs/HealthStatus.md)
 - [HealthStatusDependencies](docs/HealthStatusDependencies.md)
 - [MessageEnqueued](docs/MessageEnqueued.md)
 - [MessageSendRequest](docs/MessageSendRequest.md)
 - [ModelError](docs/ModelError.md)
 - [Routing](docs/Routing.md)
 - [To](docs/To.md)
 - [VerificationConfirmRequest](docs/VerificationConfirmRequest.md)
 - [VerificationMethod](docs/VerificationMethod.md)
 - [VerificationMode](docs/VerificationMode.md)
 - [VerificationResult](docs/VerificationResult.md)
 - [VerificationStartRequest](docs/VerificationStartRequest.md)
 - [VerificationStarted](docs/VerificationStarted.md)


<a id="documentation-for-authorization"></a>
## Documentation For Authorization


Authentication schemes defined for the API:
<a id="bearerAuth"></a>
### bearerAuth

- **Type**: Bearer authentication (JWT)

