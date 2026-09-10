Machine learning ගැන interest ඇති කෙනෙකුට time-series forecasting කියන topic එක skip කරන්න බෑ. ඇයි කියනවා නම් — real world වල data ගොඩක් time සමඟ change වෙනවා. Sales, stock prices, electricity usage, traffic — ඔක්කොම time-based data.

ඒ data forecast කරන්න classical models අතරෙන් most popular model එක තමා ARIMA. Full form: AutoRegressive Integrated Moving Average. නම ටිකක් scary වගේ පෙනුනත්, concept clear වුනාම ගොඩක් simple.

ARIMA model එකක් define කරන්නේ (p, d, q) කියන parameters 3 කින්. මේ 3 correct විදිහට choose කිරීම තමා ARIMA model selection කියන්නේ. ඒකත් properly කරන්නේ කොහොමද කියලා today's post මුළුල්ලේ බලමු.

1. ARIMA කියන්නේ මොකක්ද? 🤔
ARIMA(p, d, q) කියන 3 values ගැන කෙටියෙන් බලමු:

p — AutoRegressive terms: Current value, previous observations කීයක් මත depend වෙනවාද කියා. උදාහරණයක් ලෙස p = 2 නම් current value, ඊට කලින් values 2 ක් use කරලා predict කරනවා. 

d — Integrated / Differencing: Data එකේ trend remove කරන්නයි differencing use කරන්නේ. d = 1 නම් once difference කරනවා. Trend ඇති data directly ARIMA වලට දෙන්න බෑ — stationary කරන්න ඕන.

q — Moving Average terms: Previous forecast errors කීයක් use කරනවාද. q = 1 නම් last error one step back use කරනවා. ඔයා estimate කරපු වැරැද්ද next estimate improve කරන්නට use කරනවා කියන concept එකයි.

2. Data Load කිරීම සහ Visualize කිරීම 📊
First step: data load කරලා plot කරලා බලන්න. ඇස් දෙකෙන් data inspect කිරීම underrated step එකක් — but professionals මේක skip කරන්නේ නෑ.

```python
import pandas as pd
import matplotlib.pyplot as plt

data = pd.read_csv("sales.csv")
data['Date'] = pd.to_datetime(data['Date'])
data.set_index('Date', inplace=True)

series = data['Sales']
series.plot(figsize=(10,5))
plt.show()
```

Plot කරලා බලද්දී trend ඇද්ද, seasonality ඇද්ද, sudden jumps ඇද්ද කියා notice කරගන්න. Trend ඇත්නම්, directly ARIMA apply කරන්න බෑ — ඒකට differencing කරන්න ඕන.

3. Stationarity Check — ADF Test 🧪
ARIMA require කරන්නේ stationary data. Stationary data කියන්නේ mean සහ variance time over constant — long-term trend නෑ.

Stationary ද නෑද කියා test කරන්නට use කරන්නේ Augmented Dickey-Fuller (ADF) Test:

```python
from statsmodels.tsa.stattools import adfuller

result = adfuller(series)
print("ADF Statistic:", result[0])
print("p-value:", result[1])
```

Result interpret කරන්නේ simple විදිහට:

p-value < 0.05 → Data stationary ✅
p-value > 0.05 → Data non-stationary, differencing ඕන ❌

Example: p-value = 0.32 ආවා නම් — non-stationary. Next step: differencing.

4. Differencing — d value හොයාගන්නා හැටි
Non-stationary නම් first difference apply කරන්න:

```python
series_diff = series.diff().dropna()

result = adfuller(series_diff)
print("p-value after differencing:", result[1])
```

ඊට පස්සේ p-value 0.01 ආවා නම් — stationary! ඒ කියන්නේ d = 1. Still non-stationary නම් second differencing apply කරන්න (d = 2). Real world projects වල mostly d = 1 ම sufficient.

5. ACF සහ PACF — p සහ q හොයාගන්නා හැටි 📈
මේ step එක ගොඩක් important. PACF (Partial AutoCorrelation Function) use කරලා p find කරනවා. ACF (AutoCorrelation Function) use කරලා q find කරනවා.

```python
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf

plot_pacf(series_diff)   # p හොයන්න
plt.show()

plot_acf(series_diff)    # q හොයන්න
plt.show()
```

PACF graph එකේ lag 2 ට පස්සේ sharp cutoff ආවා නම් → p = 2. ACF graph එකේ lag 1 ට පස්සේ cutoff ආවා නම් → q = 1. ඒ කිවුවේ candidate model: ARIMA(2, 1, 1).

6. Model Train කිරීම සහ AIC Compare කිරීම
Model fit කරන්නට:

```python
from statsmodels.tsa.arima.model import ARIMA

model = ARIMA(series, order=(2, 1, 1))
model_fit = model.fit()
print(model_fit.summary())
```

Summary output එකේ AIC (Akaike Information Criterion) value හොයාගන්න. Lower AIC = better model. Multiple models compare කරලා best AIC select කරන්න:

| Model | AIC | Note |
| --- | --- | --- |
| ARIMA(1,1,1) | 540 | — |
| ARIMA(2,1,1) | 520 | Best |
| ARIMA(3,1,1) | 525 | — |

7. Auto ARIMA — Shortcut Method ⚡
Manual search කරන්න time නෑ නම් — auto_arima use කරන්න. Automatically best (p, d, q) find කරනවා:

```python
from pmdarima import auto_arima

model = auto_arima(series, seasonal=False, trace=True)
print(model.summary())
```

Production pipelines වල auto_arima ගොඩක් common. But interview වලදී manual process explain කරන්නත් ඕන — ඒ නිසා both know කරලා ඉන්න.

8. Forecast කිරීම 🔮

```python
forecast = model_fit.forecast(steps=10)
print(forecast)

plt.plot(series, label='Actual')
plt.plot(forecast, label='Forecast')
plt.legend()
plt.show()
```

Future values 10 ක් predict කරලා plot කිරීමෙන් visually validate කරගන්න පුළුවන්.

9. ARIMA Fail වෙන හේතු — ඒ Alternatives 🔄
ARIMA ලොකු model එකක් වුනත් every situation handle කරන්නේ නෑ:

Strong seasonality ඇත්නම් → SARIMA use කරන්න
Nonlinear patterns ඇත්නම් → LSTM try කරන්න
External factors (holidays, promotions) ඇත්නම් → Prophet ideal

Final Workflow — Quick Summary 📋
Data visualize කරන්න
ADF test — stationary ද check කරන්න
Non-stationary නම් differencing → d find කරන්න
ACF / PACF plots → p සහ q find කරන්න
Multiple ARIMA models train කරලා AIC compare කරන්න
Residuals check කරන්න (professionals skip කරන්නේ නෑ!)
Best model use කරලා forecast කරන්න

Conclusion
ARIMA strong classical forecasting model එකක් — simply fit කිරීම නෙමෙයි, ඇයි ඒ (p, d, q) choose කළේ කියා understand කිරීම තමා real skill එක. ඒ understanding ආවොත් SARIMA, Prophet, LSTM වගේ advanced models වලට යාමත් ගොඩක් easy වෙනවා.

Practice කරන්න real dataset use කරන්න. Kaggle වල time series datasets ගොඩk තිබෙනවා — ඒවා use කරලා try කරන්න. Code කරලා බලනකොට තමා concept properly sink වෙන්නේ. 💪

#ARIMA #TimeSeries #Python #MachineLearning #DataScience #සිංහල