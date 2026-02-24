import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Identity Service API');
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log("Identity Service running on port ");
});
