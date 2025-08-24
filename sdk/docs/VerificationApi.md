# VerificationApi

All URIs are relative to *http://localhost:8080*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**v1VerificationConfirmPost**](#v1verificationconfirmpost) | **POST** /v1/verification/confirm | Confirmar OTP o token de magic link|
|[**v1VerificationStartPost**](#v1verificationstartpost) | **POST** /v1/verification/start | Iniciar verificación por email o telegram (OTP o magic link)|

# **v1VerificationConfirmPost**
> VerificationResult v1VerificationConfirmPost(verificationConfirmRequest)


### Example

```typescript
import {
    VerificationApi,
    Configuration,
    VerificationConfirmRequest
} from '@k2600x/comm-service-sdk';

const configuration = new Configuration();
const apiInstance = new VerificationApi(configuration);

let verificationConfirmRequest: VerificationConfirmRequest; //

const { status, data } = await apiInstance.v1VerificationConfirmPost(
    verificationConfirmRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **verificationConfirmRequest** | **VerificationConfirmRequest**|  | |


### Return type

**VerificationResult**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Verificado |  -  |
|**400** | Error de validación o payload inválido |  -  |
|**401** | No autorizado |  -  |
|**410** | Expirado |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **v1VerificationStartPost**
> VerificationStarted v1VerificationStartPost(verificationStartRequest)


### Example

```typescript
import {
    VerificationApi,
    Configuration,
    VerificationStartRequest
} from '@k2600x/comm-service-sdk';

const configuration = new Configuration();
const apiInstance = new VerificationApi(configuration);

let verificationStartRequest: VerificationStartRequest; //
let idempotencyKey: string; //Clave para deduplicar solicitudes (optional) (default to undefined)

const { status, data } = await apiInstance.v1VerificationStartPost(
    verificationStartRequest,
    idempotencyKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **verificationStartRequest** | **VerificationStartRequest**|  | |
| **idempotencyKey** | [**string**] | Clave para deduplicar solicitudes | (optional) defaults to undefined|


### Return type

**VerificationStarted**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**202** | Verificación iniciada |  -  |
|**400** | Error de validación o payload inválido |  -  |
|**401** | No autorizado |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

