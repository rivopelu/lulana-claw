import type {ResponseAccountData} from "../types/response/response-account-data";
import AccountRepository from "../repositories/account.repository";
import type {Account} from "../entities/pg/account.entity";

export default class AccountService {
  private accountRepository = new AccountRepository();

  async getAccountDataByAccount(account: Account) {
    const data: ResponseAccountData = {
      email: account.email,
      name: account.name,
      id: account.id,
      profile_picture: account.profile_picture,
    }
    return data;
  }

  async getAccountDataById(id: string) {
    const account = await this.accountRepository.findById(id)
    return this.getAccountDataByAccount(account);
  }
}
