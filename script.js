// WARNING: This script exposes your Dify API key.
// For a production application, you should make API calls from a backend server
// to keep your API key secure, not directly from the user's browser.

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');

    const drugForm = document.getElementById('drug-form');
    const drugListTextarea = document.getElementById('drug-list');
    const surgeryDateInput = document.getElementById('surgery-date');
    const resultsList = document.getElementById('results-list');
    const loadingIndicator = document.getElementById('loading');

    // Set the minimum date for the surgery date input to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayString = `${yyyy}-${mm}-${dd}`;
    surgeryDateInput.min = todayString;
    surgeryDateInput.value = todayString; // Set default value to today

    drugForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        console.log('Form submission triggered');

        const drugList = drugListTextarea.value.trim().split('\n').filter(drug => drug.trim() !== '');
        const surgeryDate = surgeryDateInput.value;

        console.log('Drug list:', drugList);
        console.log('Surgery date:', surgeryDate);

        if (drugList.length === 0 || !surgeryDate) {
            alert('お薬の名前と手術予定日を両方入力してください。');
            console.warn('Validation failed: missing drug list or surgery date.');
            return;
        }

        let apiKey;
        try {
            const configResponse = await fetch('/api/config');
            const config = await configResponse.json();
            apiKey = config.apiKey;
        } catch (error) {
            console.error('Error fetching API key:', error);
            alert('APIキーの取得に失敗しました。');
            return;
        }

        resultsList.innerHTML = '';
        loadingIndicator.classList.remove('hidden');

        try {
            const apiUrl = 'https://api.dify.ai/v1/workflows/run';

            const requests = drugList.map(drug => {
                const requestBody = {
                    inputs: {
                        drug: drug.trim(),
                        opeday: surgeryDate
                    },
                    response_mode: "blocking",
                    user: "webapp-user"
                };
                console.log(`Sending request for ${drug}:`, JSON.stringify(requestBody));
                return fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
            });

            const responses = await Promise.all(requests);
            console.log('All fetch promises resolved');

            // Use Promise.all to handle responses, checking each one for errors.
            const resultsData = await Promise.all(responses.map(async (response, index) => {
                const drugName = drugList[index];
                if (!response.ok) {
                    let errorMessage = `「${drugName}」の確認中にエラーが発生しました (Status: ${response.status})`;
                    try {
                        const errorData = await response.json();
                        console.error(`API Error for ${drugName}:`, errorData);
                        errorMessage += `: ${errorData.message || 'Unknown API error'}`;
                    } catch (e) {
                        console.error(`Non-JSON error response for ${drugName}:`, response.statusText);
                        errorMessage += `: ${response.statusText}`;
                    }
                    // Throw an error to be caught by the outer catch block for this specific drug
                    throw new Error(errorMessage);
                }
                const data = await response.json();
                console.log(`Received data for ${drugName}:`, data);
                return data;
            }));

            resultsData.forEach((result, index) => {
                const drugName = drugList[index];
                const listItem = document.createElement('li');
                // DifyのAPIレスポンス形式に合わせて修正
                if (result && result.data && result.data.outputs && result.data.outputs.text) {
                    listItem.textContent = `${drugName}: ${result.data.outputs.text}`;
                } else {
                    listItem.textContent = `${drugName}: 結果が取得できませんでした。`;
                    console.warn(`No valid output for ${drugName}:`, result);
                }
                resultsList.appendChild(listItem);
            });

        } catch (error) {
            console.error('A critical error occurred:', error);
            const errorItem = document.createElement('li');
            errorItem.textContent = `エラーが発生しました: ${error.message}。ブラウザのコンソールで詳細を確認してください。CORSポリシーが原因である可能性があります。`;
            errorItem.style.color = 'red';
            resultsList.appendChild(errorItem);
        } finally {
            loadingIndicator.classList.add('hidden');
            console.log('Processing finished.');
        }
    });
});