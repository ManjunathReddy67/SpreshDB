const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// Configure Google Sheets API
const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json', // Downloaded from Google Cloud Console
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = '1xPYrcPCBQRbDe78p6ZD93g55R5kAiqLg6xpG1_3dnXU';
const RANGES = {
  allProducts: 'Sheet2!A3:G', // Products data
  users: 'Sheet1!A2:C', // Products data
  emails: 'Sheet1!B:B',      // Email data
  signUp: 'Sheet1!A:E',      // User sign-up data
  products: 'Sheet4!A:Z',      // User sign-up data
  orders: 'Sheet3!A:Z',      // Order data
  phoneNumber: 'Sheet1!A2:C',      // Order data
  orderStatus: 'Sheet3!F:G',   // Inventory data
  inventory: 'Sheet4!A:H',   // Inventory data
};

app.post('/api/Order', async (req, res) => {
  try {
    // Authorize Google Sheets API
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    const { user, deliveryAddress, items, total, paymentMethod ,orderId} = req.body;
    
    
    const RESPONSE1=await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.phoneNumber, // Covers entire email column
    });

    // console.log(RESPONSE1.data.values);
    const rows1 = RESPONSE1.data.values;
      rows1.forEach((row)=>{
        if(row[1].toLowerCase()===user.id.toLowerCase()){
          user.phone=row[2];
          return;
        }

      })
    // Check if all necessary data is present
    if (!user || !deliveryAddress || !items || !total || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Missing required order data.' });
    }

    let itemsOrdered="";
    // Structure the data in the format expected by Google Sheets API
    items.map(item => [
      itemsOrdered+=`{${item.name},${item.price},${item.quantity},${item.total}}`
    ]);
    const deliveryAddressString = `${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.state}, ${deliveryAddress.pincode}`;

    const RESPONSE2 = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.products, // Define the range for orders
    });

    const existingRows = RESPONSE2.data.values;
    let updatedRows = existingRows;

    items.forEach((item, index) => {
      const existingIndex = existingRows.findIndex(row => Number(row[0]) === Number(item.productId));
      

      if (existingIndex !== -1) {
        rows1.forEach((row)=>{
          if(row[1].toLowerCase()===user.id.toLowerCase()){
            user.name="{"+row[0]+","+item.quantity+"}";
          }
        })
        // Update quantity if the product already exists
        updatedRows[existingIndex][3] = Number(updatedRows[existingIndex][3]) + item.quantity; // Increment existing quantity
        updatedRows[existingIndex][5] = updatedRows[existingIndex][5].concat(user.name); // Increment existing quantity

      } else {  
        rows1.forEach((row)=>{
          if(row[1].toLowerCase()===user.id.toLowerCase()){
            user.name="{"+row[0]+","+item.quantity+"}";
          }
        }) 
        // Add new product if it does not exist in existing rows
        updatedRows.push([Number(item.productId),item.name, Number(item.price), item.quantity,"",user.name]);
      }
    });

    // Update the Google Sheet with the new data
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.products,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: updatedRows,
      },
    });








    // Append the product data to the Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.orders,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            user.id,
            deliveryAddressString,
            itemsOrdered,
            total,
            paymentMethod,
            user.phone+orderId,
            "confirmed",
            user.phone,
            new Date().toLocaleString(),

          ],
        ],
      },
    });

    res.status(200).json({ success: true, message: 'Order placed successfully!' });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ success: false, message: 'Failed to place order.' });
  }
});



app.get(`/allOrders`, async (req, res) => {

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Fetch all existing emails from the spreadsheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.orders, // Covers entire email column
    });
    res.status(200).json({ success: true,data:response.data, message: 'products up successful!' });
  } catch (error) {
    console.error('Error fetching from google Google Sheets:', error);
    res.status(500).json({ success: false, message: 'Failed to get products data' });
  }
});



app.post('/api/addProduct', async (req, res) => {
  try {
    const { id, name, price, category, unit, description, image } = req.body;

    // Authorize Google Sheets API
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Read existing data from the Google Sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.allProducts, // Example: 'Sheet1!A2:G' (skip headers)
    });

    const rows = response.data.values || [];
    
    // Check if the id already exists
    const idExists = rows.some((row) => row[0] == id); // Assuming 'id' is in column A

    if (idExists) {
      return res.status(200).json({ success: false, message: 'Product with the same ID already exists.' });
    }

    // Append the product data to the Google Sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.allProducts,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[id, name, price, category, unit, description, image]],
      },
    });

    res.status(200).json({ success: true, message: 'Product added successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add product.' });
  }
});




app.get('/allProducts', async (req, res) => {

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Fetch all existing emails from the spreadsheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.allProducts, // Covers entire email column
    });

  

    res.status(200).json({ success: true,data:response.data, message: 'products up successful!' });
  } catch (error) {
    console.error('Error fetching from google Google Sheets:', error);
    res.status(500).json({ success: false, message: 'Failed to get products data' });
  }
});



app.get('/allCustomers', async (req, res) => {

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Fetch all existing emails from the spreadsheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.users, // Covers entire email column
    });

  

    res.status(200).json({ success: true,data:response.data, message: 'products up successful!' });
  } catch (error) {
    console.error('Error fetching from google Google Sheets:', error);
    res.status(500).json({ success: false, message: 'Failed to get products data' });
  }
});







// Route to handle form submission
app.post('/updateOrderStatus', async (req, res) => {
  const { id,status } = req.body;

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Fetch all existing emails from the spreadsheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.orderStatus, // Covers entire email column
    });
    const rows = response.data.values;
   
    let orderFound = false;

    // Find the order with the matching ID and update its status
    for (let row of rows) {
      if (row[0] === id) { // Assuming the first column is the ID column
        row[1] = status; // Assuming status is in the 5th column (index 4)
        orderFound = true;
        break;
      }
    }

    if (orderFound) {
      // Update the order with the new status
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGES.orderStatus,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: rows,
        },
      });
      res.status(200).json({ success: true, message: 'Status Updated successfully!' });
    } else {
      res.status(404).json({ success: false, message: 'Order not found' });
    }
  } catch (error) {
    console.error('Error in updating order status to Google Sheets:', error);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
});

// Route to handle form submission
app.post('/signup', async (req, res) => {
  const { name, email, phone, password,date } = req.body;

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Fetch all existing emails from the spreadsheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.emails, // Covers entire email column
    });

    const existingEmails = response.data.values
      ? response.data.values.flat().map(email => email.toLowerCase())
      : [];


    // Check if the email already exists
    if (existingEmails.includes(email.toLowerCase())) {
      return res.status(200).json({
        success: false,
        message: 'Email already exists. Please use a different email.',
      });
    }

    // Insert the new user's data only after email check
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGES.signUp,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[name, email, phone, password,new Date().toLocaleString()]],
      },
    });

    res.status(200).json({ success: true, message: 'Sign up successful!' });
  } catch (error) {
    console.error('Error writing to Google Sheets:', error);
    res.status(500).json({ success: false, message: 'Failed to save data' });
  }
});

app.listen(5000, '0.0.0.0', () => {
    console.log('Server running on http://0.0.0.0:5000');
});

