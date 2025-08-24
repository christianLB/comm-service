# MessagesApi

All URIs are relative to *http://localhost:8080*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**v1MessagesSendPost**](#v1messagessendpost) | **POST** /v1/messages/send | Enviar notificación (Telegram/Email/Auto) con fallback y TTL|

# **v1MessagesSendPost**
> MessageEnqueued v1MessagesSendPost(messageSendRequest)


### Example

```typescript
import {
    MessagesApi,
    Configuration,
    MessageSendRequest
} from '@k2600x/comm-service-sdk';

const configuration = new Configuration();
const apiInstance = new MessagesApi(configuration);

let messageSendRequest: MessageSendRequest; //
let idempotencyKey: string; //Clave para deduplicar solicitudes (optional) (default to undefined)

const { status, data } = await apiInstance.v1MessagesSendPost(
    messageSendRequest,
    idempotencyKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **messageSendRequest** | **MessageSendRequest**|  | |
| **idempotencyKey** | [**string**] | Clave para deduplicar solicitudes | (optional) defaults to undefined|


### Return type

**MessageEnqueued**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**202** | Mensaje encolado |  -  |
|**400** | Error de validación o payload inválido |  -  |
|**401** | No autorizado |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

