import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Learning Service API');
});

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log("Learning Service running on port ");
});
