import { Injectable } from '@nestjs/common';
import { Card } from './card.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateCardDTO } from './DTO/create.DTO';
import { UpdateCardDTO } from './DTO/update.DTO';

@Injectable()
export class CardRepository extends Repository<Card> {
  constructor(private readonly dataSource: DataSource) {
    super(Card, dataSource.createEntityManager());
  }

  async findOneById(id: number): Promise<Card | null> {
    const foundCard = await this.findOne({
      where: { id },
      relations: { comments: true },
    });
    return foundCard;
  }

  async createCard(data: CreateCardDTO): Promise<Card> {
    const card = this.create(data);
    await this.findAndCount().then((data) => {
      this.merge(card, { cardNum: data[1] + 1 });
    });

    const createdCard = await this.save(card);
    return createdCard;
  }

  async updateCard(id: number, data: UpdateCardDTO): Promise<number> {
    const updateCnt = (await this.update({ id }, data)).affected;

    return updateCnt;
  }

  async updateCardNumber(
    min: number,
    max: number,
    newCardNum: number,
    card: Card,
    cards: Card[],
    isSame: boolean,
    diffCards?: Card[],
    columnId?: number,
  ) {
    return await this.dataSource.transaction(async (manager) => {
      if (isSame) {
        // 같은 컬럼일경우
        if (card.cardNum === min) {
          cards
            .filter((card) => {
              return card.cardNum > min && card.cardNum <= max;
            })
            .forEach((card) => {
              manager.update(Card, card, { cardNum: card.cardNum - 1 });
            });
          return (await manager.update(Card, card, { cardNum: max })).affected;
        } else if (card.cardNum === max) {
          cards
            .filter((card) => {
              return card.cardNum <= max && card.cardNum > min;
            })
            .forEach(async (card) => {
              card.cardNum++;
              await manager.update(Card, card, { cardNum: card.cardNum + 1 });
            });
          return (await manager.update(Card, card, { cardNum: min })).affected;
        }
      } else {
        // 다른 컬럼일경우

        diffCards
          .filter((card) => {
            card.cardNum >= newCardNum;
          })
          .forEach(async (card) => {
            card.cardNum++;
            await manager.save(card);
          });
        cards
          .filter((val) => {
            val.cardNum > card.cardNum;
          })
          .forEach(async (card) => {
            card.cardNum--;
            await manager.save(card);
          });
        const updateCnt = (
          await manager.update(Card, card, {
            cardNum: newCardNum,
            columnId,
          })
        ).affected;
        return updateCnt;
      }
    });
  }

  async deleteCard(id: number): Promise<number> {
    const result = await this.delete({ id });

    return result.affected;
  }
}
