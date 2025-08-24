# CommandsApi

All URIs are relative to *http://localhost:8080*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**v1CommandsDispatchPost**](#v1commandsdispatchpost) | **POST** /v1/commands/dispatch | Despachar comando a un servicio (con opción de confirmación Sí/No)|

# **v1CommandsDispatchPost**
> CommandAccepted v1CommandsDispatchPost(commandDispatchRequest)


### Example

```typescript
import {
    CommandsApi,
    Configuration,
    CommandDispatchRequest
} from '@k2600x/comm-service-sdk';

const configuration = new Configuration();
const apiInstance = new CommandsApi(configuration);

let commandDispatchRequest: CommandDispatchRequest; //
let idempotencyKey: string; //Clave para deduplicar solicitudes (optional) (default to undefined)

const { status, data } = await apiInstance.v1CommandsDispatchPost(
    commandDispatchRequest,
    idempotencyKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **commandDispatchRequest** | **CommandDispatchRequest**|  | |
| **idempotencyKey** | [**string**] | Clave para deduplicar solicitudes | (optional) defaults to undefined|


### Return type

**CommandAccepted**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**202** | Comando aceptado |  -  |
|**400** | Error de validación o payload inválido |  -  |
|**401** | No autorizado |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

