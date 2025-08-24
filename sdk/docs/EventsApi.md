# EventsApi

All URIs are relative to *http://localhost:8080*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**v1EventsPost**](#v1eventspost) | **POST** /v1/events | Ingesta de eventos desde servicios (status de comandos, outputs)|

# **v1EventsPost**
> v1EventsPost(eventIn)


### Example

```typescript
import {
    EventsApi,
    Configuration,
    EventIn
} from '@k2600x/comm-service-sdk';

const configuration = new Configuration();
const apiInstance = new EventsApi(configuration);

let eventIn: EventIn; //

const { status, data } = await apiInstance.v1EventsPost(
    eventIn
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **eventIn** | **EventIn**|  | |


### Return type

void (empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**204** | Aceptado |  -  |
|**400** | Error de validación o payload inválido |  -  |
|**401** | No autorizado |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

