import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Finance MLM Service API');
});

const port = process.env.PORT || 3003;
app.listen(port, () => {
  console.log("Finance MLM Service running on port ");
});
