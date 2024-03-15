import { Client } from 'whatsapp-web.js';
import { OpenAI as OpenAIClient } from 'openai';
import qrcode from 'qrcode-terminal';
import { OpenAI } from "@langchain/openai";
import { FaissStore } from "langchain/vectorstores/faiss";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { loadQAStuffChain, loadQAMapReduceChain } from "langchain/chains";


const client = new Client();
const openaiApiKey = ''; // Replace this with your OpenAI API key

const openaiClient = new OpenAIClient({
    apiKey: openaiApiKey,
});

// Object to store user contexts and initial message status
const userContexts = {
    'user-id': {
        messages: [],
    }

};

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    qrcode.generate(qr, {small: true});

});

client.on('ready', () => {

    console.log('Client is ready!');

});

client.on('message', async (msg) => {
    console.log('Received message:', msg.body);
    if (msg.body === '!ping') {
        msg.reply('pong');
        console.log('pong');
        return;
    } if (msg.body === '!help') {
        msg.reply(`🤖 Lista de comandos: \n✅ !ping: Responde con "pong" \n✅ !help: Muestra esta lista de comandos \n✅ !reset: Reinicia la conversación \n✅ !docs: Muestra la lista de documentos disponibles`);   
        console.log('help');
        return;
    }
    if (msg.body === '!reset') {
        userContexts[msg.from].messages = [];
        msg.reply('🤖 Conversación reiniciada');
        console.log('reset');
        return;
    }

    if (msg.body === '!docs') {
        msg.reply(`📚 Lista de documentos disponibles 📚\n✅ Ecuaciones lineales \n-- ecuaciones-lineales 1 \n-- ecuaciones-lineales 2 \n-- ecuaciones-lineales 3 \npara realizar preguntas sobre un documento, escribe el nombre del documento seguido de tu pregunta, por ejemplo: \n !ecuaciones-lineales ¿Cuál es la fórmula para resolver una ecuación lineal? `);
        console.log('docs');
        return;
    }

    // if messge.body starts whit ecuaciones-lineales
    if (msg.body.startsWith('!ecuaciones-lineales')) {
        const question = msg.body.replace('ecuaciones-lineales', '').trim();
        const directory = 'C:/Users/rogel/Documents/TECBOT' //saved directory in .env file
        const loadedVectorStore = await FaissStore.load(
          directory,
          new OpenAIEmbeddings()
          );
        const result = await loadedVectorStore.similaritySearch(question, 1);
        const llmA = new OpenAI({ modelName: "gpt-3.5-turbo"});
        const chainA = loadQAStuffChain(llmA);
        const resA = await chainA.call({
          input_documents: result,
          question,
        });
        msg.reply(resA.text);
        console.log('Generated completion:', resA.score);

        return;
    }

    else {
        // Check if user exists in the user contexts, if not, create a new context and send initial message
        const userId = msg.from;
        if (!userContexts[userId]) {
            userContexts[userId] = {}; // Initialize user context if it doesn't exist
            userContexts[userId].messages = [];
            userContexts[userId].messages.push({"role": "system", "content": `You are a helpful assistant that helps students learn and understand the course content my name is ${msg._data.notifyName} talk me by my name every time in Mexican Spanish
            and use emogis , dont use bad words and dont permit bad words
            `});
        }
        userContexts[userId].messages.push({"role": "user", "content": msg.body});
        // Use OpenAI GPT-3 to generate completion
        const completion = await generateCompletion(userContexts[userId].messages);
        // Store the completion context for the user
        userContexts[userId].messages.push({"role": "assistant", "content": completion});
        // Send the completion back to the user
        msg.reply(completion);
        //verify if is the first message of the user to send the instructions
        if (userContexts[userId].messages.length === 3) {
            msg.reply(`🤖 Lista de comandos: \n✅ !ping: Responde con "pong" \n✅ !help: Muestra esta lista de comandos \n✅ !reset: Reinicia la conversación \n✅ !docs: Muestra la lista de documentos disponibles`);  
        }
        return;

    }
});


client.initialize();

async function generateCompletion(context) {
    try {
        const completion = await openaiClient.chat.completions.create({
            messages: context,
            model: "gpt-3.5-turbo",
          });
        
          console.log(completion.choices[0]);
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Error generating completion:', error);
        return { text: 'Error generating completion.' };
    }
}


